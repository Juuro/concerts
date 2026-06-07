/**
 * Setlist.fm REST API client (rest/1.0).
 *
 * House style (mirrors src/utils/photon.ts and src/utils/lastfm.ts):
 * - API key read from env at call time; missing key -> graceful null/[].
 * - Single-file request pacing for the free-tier 2 req/sec limit
 *   (reserve the next slot BEFORE awaiting — the photon DA2 race fix).
 * - Global circuit breaker on HTTP 429/403.
 * - AbortController timeout; never throws across the boundary (returns null/[]).
 * - In-memory TTL cache of SUCCESSFUL responses only (failures are not cached,
 *   so a transient 429 never pins "nothing found" for the cache window).
 */

import { isFeatureEnabled, FEATURE_FLAGS } from "@/utils/featureFlags"
import type {
  SetlistfmArtist,
  SetlistfmSearchArtistsResponse,
  SetlistfmSearchSetlistsResponse,
  SetlistfmSetlist,
} from "@/types/setlistfm"

const BASE_URL = "https://api.setlist.fm/rest/1.0"
const USER_AGENT = "Concertivity/1.0 (https://github.com/Juuro/Concertivity)"
const MIN_REQUEST_INTERVAL = 600 // ms — safely under Setlist.fm's 2 req/s cap
const TIMEOUT_MS = 8000
const CIRCUIT_COOLDOWN_MS = 60_000
const RATE_LIMIT_RETRY_DELAY_MS = 1500

const SEARCH_TTL_MS = 10 * 60 * 1000 // setlists are historical; cache 10 min
const SETLIST_TTL_MS = 60 * 60 * 1000 // a single setlist is effectively immutable
const MAX_CACHE_ENTRIES = 500

let nextAvailableAt = 0
let circuitOpenUntil = 0
/** Serializes pacing so concurrent callers cannot burst past the rate limit. */
let paceQueue: Promise<void> = Promise.resolve()

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

function makeCache<T>() {
  const map = new Map<string, CacheEntry<T>>()
  return {
    get(key: string): T | undefined {
      const entry = map.get(key)
      if (!entry) return undefined
      if (entry.expiresAt < Date.now()) {
        map.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key: string, value: T, ttl: number): void {
      if (map.size >= MAX_CACHE_ENTRIES) map.clear()
      map.set(key, { value, expiresAt: Date.now() + ttl })
    },
  }
}

const searchCache = makeCache<SetlistfmSetlist[]>()
const artistCache = makeCache<SetlistfmArtist[]>()
const setlistCache = makeCache<SetlistfmSetlist | null>()

const pendingSearch = new Map<string, Promise<SetlistfmSetlist[]>>()
const pendingArtists = new Map<string, Promise<SetlistfmArtist[]>>()
const pendingSetlist = new Map<string, Promise<SetlistfmSetlist | null>>()

function isAvailable(): boolean {
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_CONCERT_AI_SEARCH, false))
    return false
  if (!process.env.SETLISTFM_API_KEY) return false
  if (Date.now() < circuitOpenUntil) return false
  return true
}

async function pace(): Promise<void> {
  const turn = paceQueue.then(async () => {
    const now = Date.now()
    const waitMs = Math.max(0, nextAvailableAt - now)
    nextAvailableAt = now + waitMs + MIN_REQUEST_INTERVAL
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  })
  paceQueue = turn.catch(() => undefined)
  await turn
}

/** Setlist.fm sometimes returns a single object instead of a one-element array. */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Perform a single GET against Setlist.fm.
 * Returns the parsed body on success, or `null` on ANY failure (missing key,
 * timeout, network error, non-2xx). A 429/403 additionally trips the circuit
 * breaker so subsequent calls short-circuit for the cooldown window.
 */
async function fetchSetlistfm(
  path: string,
  url: string,
  apiKey: string
): Promise<Response | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    })
  } catch (error) {
    console.error(`Setlist.fm fetch failed for ${path}:`, error)
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

async function setlistfmGet<T>(
  path: string,
  search?: URLSearchParams
): Promise<T | null> {
  const apiKey = process.env.SETLISTFM_API_KEY
  if (!apiKey) {
    console.warn(
      "SETLISTFM_API_KEY not configured; Setlist.fm lookups disabled"
    )
    return null
  }

  const qs = search?.toString()
  const url = qs ? `${BASE_URL}${path}?${qs}` : `${BASE_URL}${path}`

  await pace()
  let res = await fetchSetlistfm(path, url, apiKey)
  if (!res) return null

  if (res.status === 429) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS)
    )
    await pace()
    res = await fetchSetlistfm(path, url, apiKey)
    if (!res) return null
  }

  if (res.status === 429 || res.status === 403) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS
    console.warn(
      `Setlist.fm rate limit / forbidden (${res.status}); circuit open for ${CIRCUIT_COOLDOWN_MS}ms`
    )
    return null
  }

  if (res.status === 404) {
    // Expected "not found" — not an error worth logging loudly.
    return null
  }

  if (!res.ok) {
    console.error(`Setlist.fm request failed: ${res.status} ${res.statusText}`)
    return null
  }

  try {
    return (await res.json()) as T
  } catch (error) {
    console.error("Failed to parse Setlist.fm response:", error)
    return null
  }
}

export interface SetlistSearchParams {
  artistName?: string
  artistMbid?: string
  cityName?: string
  venueName?: string
  countryCode?: string
  tourName?: string
  year?: number
}

function buildSearchParams(params: SetlistSearchParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.artistMbid) search.set("artistMbid", params.artistMbid)
  else if (params.artistName) search.set("artistName", params.artistName)
  if (params.cityName) search.set("cityName", params.cityName)
  if (params.venueName) search.set("venueName", params.venueName)
  if (params.countryCode) search.set("countryCode", params.countryCode)
  if (params.tourName) search.set("tourName", params.tourName)
  if (params.year) search.set("year", String(params.year))
  return search
}

/**
 * Search setlists (page 1). Returns `[]` on no-match OR failure (callers can't
 * distinguish, by design — both mean "nothing to show"). Successful responses
 * are cached for 10 minutes; failures are not cached.
 */
export async function searchSetlists(
  params: SetlistSearchParams
): Promise<SetlistfmSetlist[]> {
  if (!isAvailable()) return []

  const search = buildSearchParams(params)
  const key = search.toString()
  if (!key) return []

  const cached = searchCache.get(key)
  if (cached) return cached

  const inflight = pendingSearch.get(key)
  if (inflight) return inflight

  const promise = (async () => {
    const data = await setlistfmGet<SetlistfmSearchSetlistsResponse>(
      "/search/setlists",
      search
    )
    const setlists = asArray(data?.setlist)
    if (data !== null) searchCache.set(key, setlists, SEARCH_TTL_MS)
    return setlists
  })()

  pendingSearch.set(key, promise)
  try {
    return await promise
  } finally {
    pendingSearch.delete(key)
  }
}

/**
 * Resolve an artist name to MBID candidates (relevance-sorted). Used to pin
 * searches by `artistMbid` so a name query doesn't return unrelated artists.
 */
export async function searchArtists(
  artistName: string
): Promise<SetlistfmArtist[]> {
  if (!isAvailable()) return []
  const trimmed = artistName.trim()
  if (!trimmed) return []

  const key = trimmed.toLowerCase()
  const cached = artistCache.get(key)
  if (cached) return cached

  const inflight = pendingArtists.get(key)
  if (inflight) return inflight

  const search = new URLSearchParams({ artistName: trimmed, sort: "relevance" })
  const promise = (async () => {
    const data = await setlistfmGet<SetlistfmSearchArtistsResponse>(
      "/search/artists",
      search
    )
    const artists = asArray(data?.artist)
    if (data !== null) artistCache.set(key, artists, SEARCH_TTL_MS)
    return artists
  })()

  pendingArtists.set(key, promise)
  try {
    return await promise
  } finally {
    pendingArtists.delete(key)
  }
}

/**
 * Authoritative single-setlist fetch by id — used by the one-click add flow so
 * the concert is created from fresh server-side data, never a stale client
 * payload. Returns `null` on not-found or failure.
 */
export async function getSetlistById(
  setlistId: string
): Promise<SetlistfmSetlist | null> {
  if (!isAvailable()) return null
  const id = setlistId.trim()
  if (!id) return null

  const cached = setlistCache.get(id)
  if (cached !== undefined) return cached

  const inflight = pendingSetlist.get(id)
  if (inflight) return inflight

  const promise = (async () => {
    const data = await setlistfmGet<SetlistfmSetlist>(
      `/setlist/${encodeURIComponent(id)}`
    )
    // Only cache definitive results (a found setlist). A null here may be a
    // transient failure, so leave it uncached for a retry.
    if (data) setlistCache.set(id, data, SETLIST_TTL_MS)
    return data
  })()

  pendingSetlist.set(id, promise)
  try {
    return await promise
  } finally {
    pendingSetlist.delete(id)
  }
}
