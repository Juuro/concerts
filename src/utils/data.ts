import fs from "node:fs/promises"
import path from "node:path"
import { isFeatureEnabled, FEATURE_FLAGS } from "./featureFlags"
import type { GeocodingData, PhotonReverseResponse } from "../types/geocoding"

type GeocodingCacheFile = {
  locations?: Record<string, GeocodingData>
  generatedAt?: string
  meta?: unknown
}

let geocodingCachePromise: Promise<Map<string, GeocodingData>> | null = null

/**
 * Compute a stable cache key for a coordinate pair.
 */
function geocodingCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`
}

/**
 * Format coordinates as a string for display
 */
function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`
}

async function loadGeocodingCache(): Promise<Map<string, GeocodingData>> {
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING, true)) {
    return new Map()
  }

  if (geocodingCachePromise) return geocodingCachePromise

  geocodingCachePromise = (async () => {
    const candidates = [
      path.join(process.cwd(), ".next", "cache", "geocoding.json"),
      path.join(process.cwd(), ".cache", "geocoding.json"),
    ]

    for (const filePath of candidates) {
      try {
        const raw = await fs.readFile(filePath, "utf8")
        const parsed = JSON.parse(raw) as GeocodingCacheFile
        const locations = parsed?.locations ?? {}
        return new Map(Object.entries(locations))
      } catch {
        // ignore missing/invalid cache file; fall back to next candidate
      }
    }

    return new Map()
  })()

  return geocodingCachePromise
}

const GEOCODING_MIN_REQUEST_INTERVAL = 700 // be polite: ~1.4 req/sec
const GEOCODING_GLOBAL_RATE_LIMIT_COOLDOWN = 60_000
let geocodingLastRequestAt = 0
let geocodingGlobalRateLimitUntil = 0
let geocodingQueue: Promise<void> = Promise.resolve()
const pendingGeocodingRequests = new Map<
  string,
  Promise<GeocodingData | null>
>()

async function fetchPhotonReverseGeocoding(
  lat: number,
  lon: number
): Promise<GeocodingData | null> {
  if (Date.now() < geocodingGlobalRateLimitUntil) {
    return null
  }

  const now = Date.now()
  const waitMs = Math.max(
    0,
    geocodingLastRequestAt + GEOCODING_MIN_REQUEST_INTERVAL - now
  )
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  geocodingLastRequestAt = Date.now()

  const baseUrl = process.env.PHOTON_BASE_URL || "https://photon.komoot.io"
  const url = new URL("/reverse", baseUrl)
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))
  url.searchParams.set("limit", "1")

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    if (res.status === 429) {
      geocodingGlobalRateLimitUntil =
        Date.now() + GEOCODING_GLOBAL_RATE_LIMIT_COOLDOWN
      return null
    }

    if (!res.ok) return null

    const json = (await res.json()) as PhotonReverseResponse
    const first = Array.isArray(json?.features) ? json.features[0] : undefined
    const props = first?.properties

    const city =
      props?.city ||
      props?.locality ||
      props?.name ||
      props?.county ||
      props?.state ||
      ""

    if (typeof city === "string" && city.trim()) {
      return {
        _normalized_city: city.trim(),
        city: typeof props?.city === "string" ? props.city : undefined,
        locality:
          typeof props?.locality === "string" ? props.locality : undefined,
        name: typeof props?.name === "string" ? props.name : undefined,
        county: typeof props?.county === "string" ? props.county : undefined,
        state: typeof props?.state === "string" ? props.state : undefined,
        country: typeof props?.country === "string" ? props.country : undefined,
      }
    }

    return null
  } catch {
    return null
  }
}

async function withGeocodingQueue<T>(fn: () => Promise<T>): Promise<T> {
  const prev = geocodingQueue
  let releaseNext!: () => void
  geocodingQueue = new Promise<void>((resolve) => {
    releaseNext = resolve
  })
  await prev
  try {
    return await fn()
  } finally {
    releaseNext()
  }
}

async function fetchPhotonReverseGeocodingQueued(
  lat: number,
  lon: number
): Promise<GeocodingData | null> {
  const key = geocodingCacheKey(lat, lon)
  const existing = pendingGeocodingRequests.get(key)
  if (existing) return existing

  const promise = (async () => {
    // Serialize external calls to avoid bursts from Promise.all during dev.
    return await withGeocodingQueue(() => fetchPhotonReverseGeocoding(lat, lon))
  })()

  pendingGeocodingRequests.set(key, promise)
  try {
    return await promise
  } finally {
    pendingGeocodingRequests.delete(key)
  }
}

/**
 * Fetch geocoding data for a location (uncached version)
 */
export async function getGeocodingDataUncached(
  lat: number,
  lon: number
): Promise<GeocodingData> {
  // Check feature flag first - if disabled, return coordinates as string
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING, true)) {
    return {
      _normalized_city: formatCoordinates(lat, lon),
      _is_coordinates: true,
    }
  }

  const geocodingByCoord = await loadGeocodingCache()
  const cached = geocodingByCoord.get(geocodingCacheKey(lat, lon))
  if (cached && cached._normalized_city && !cached._is_coordinates) {
    return cached
  }

  // If the cache is missing or is a fallback, try Photon live (dev only) with global pacing.
  const live = await fetchPhotonReverseGeocodingQueued(lat, lon)
  if (live && live._normalized_city) {
    return live
  }

  // Fallback to coordinates if geocoding fails
  return {
    _normalized_city: formatCoordinates(lat, lon),
    _is_coordinates: true,
  }
}

export async function getGeocodingData(
  lat: number,
  lon: number
): Promise<GeocodingData> {
  return getGeocodingDataUncached(lat, lon)
}
