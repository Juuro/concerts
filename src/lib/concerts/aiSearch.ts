import { prisma } from "@/lib/prisma"
import { getOrCreateBand, enrichBandData } from "@/lib/bands"
import { searchVenues } from "@/utils/photon"
import { slugify } from "@/utils/helpers"
import { isFeatureEnabled, FEATURE_FLAGS } from "@/utils/featureFlags"
import {
  searchSetlists,
  searchArtists,
  getSetlistById,
  type SetlistSearchParams,
} from "@/utils/setlistfm"
import {
  parseConcertProse,
  isGenericArtistPhrase,
} from "@/lib/concerts/aiParse"
import { rankCandidatesByHints } from "@/lib/concerts/aiRank"
import type { SetlistfmSetlist } from "@/types/setlistfm"
import type {
  CandidateShow,
  ConcertAiSearchResponse,
  ParsedConcertQuery,
  Season,
} from "@/types/concertAiSearch"
import type { CreateConcertInput } from "@/lib/concerts/types"

/** Max distinct year-scoped Setlist.fm queries per submission (rate-limit guard). */
const MAX_YEAR_QUERIES = 3
/** Max candidate shows surfaced to the user. */
const MAX_CANDIDATES = 10

const SEASON_MONTHS: Record<Season, number[]> = {
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  autumn: [9, 10, 11],
  winter: [12, 1, 2],
}

// ---------------------------------------------------------------------------
// Date helpers — Setlist.fm eventDate is `dd-MM-yyyy` (NOT a JS-parseable date).
// ---------------------------------------------------------------------------

const EVENT_DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/

/** Parse Setlist.fm `dd-MM-yyyy` to a UTC-midnight Date + ISO `yyyy-mm-dd`. */
export function parseEventDate(
  eventDate: string
): { date: Date; iso: string; month: number; year: number } | null {
  const m = EVENT_DATE_RE.exec(eventDate.trim())
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900) return null

  const date = new Date(Date.UTC(yyyy, mm - 1, dd))
  // Reject impossible dates (e.g. 31-02) via round-trip.
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null
  }
  // Reject far-future dates (allow up to next year for upcoming shows).
  if (yyyy > new Date().getUTCFullYear() + 1) return null

  return {
    date,
    iso: `${m[3]}-${m[2]}-${m[1]}`,
    month: mm,
    year: yyyy,
  }
}

function normalizeArtist(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Setlist.fm `cityName` must match exactly — values like "London, England"
 * return 404. Keep the city token only.
 */
function normalizeCityName(city: string | null): string | null {
  if (!city) return null
  const primary = city.split(",")[0]?.trim()
  if (!primary) return null
  // Title-case for Groq/user lowercase ("stuttgart" -> "Stuttgart").
  return primary.replace(
    /\b[\p{L}\p{M}']+\b/gu,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
}

function buildSearchBase(
  parsed: ParsedConcertQuery,
  artistMbid: string | null
): SetlistSearchParams {
  const city = normalizeCityName(parsed.city)
  return {
    ...(artistMbid
      ? { artistMbid }
      : parsed.artist
        ? { artistName: parsed.artist }
        : {}),
    ...(city ? { cityName: city } : {}),
    ...(parsed.venue ? { venueName: parsed.venue } : {}),
    ...(parsed.countryCode ? { countryCode: parsed.countryCode } : {}),
    ...(parsed.festival ? { tourName: parsed.festival } : {}),
  }
}

async function querySetlists(
  base: SetlistSearchParams,
  years: number[] | null
): Promise<SetlistfmSetlist[]> {
  const raw: SetlistfmSetlist[] = []
  if (years) {
    for (const year of years) {
      raw.push(...(await searchSetlists({ ...base, year })))
    }
  } else {
    raw.push(...(await searchSetlists(base)))
  }
  return raw
}

// ---------------------------------------------------------------------------
// Search orchestration
// ---------------------------------------------------------------------------

interface YearPlan {
  /** Explicit years to query (one Setlist.fm call each), or null for one un-yeared call. */
  years: number[] | null
  /** When the range was too wide to fan out: filter results to [lo, hi] client-side. */
  yearFilter: { lo: number; hi: number } | null
}

function planYears(parsed: ParsedConcertQuery): YearPlan {
  if (parsed.yearStart == null && parsed.yearEnd == null) {
    return { years: null, yearFilter: null }
  }
  const a = parsed.yearStart ?? parsed.yearEnd!
  const b = parsed.yearEnd ?? parsed.yearStart!
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const span = hi - lo + 1
  if (span <= MAX_YEAR_QUERIES) {
    const years: number[] = []
    for (let y = lo; y <= hi; y++) years.push(y)
    return { years, yearFilter: null }
  }
  // Too wide to fan out: one broad query, then filter client-side.
  return { years: null, yearFilter: { lo, hi } }
}

async function resolveArtistMbid(name: string): Promise<string | null> {
  const artists = await searchArtists(name)
  if (!artists.length) return null
  const target = normalizeArtist(name)
  const exact = artists.find((a) => normalizeArtist(a.name) === target)
  return (exact ?? artists[0]).mbid ?? null
}

function toCandidate(setlist: SetlistfmSetlist): CandidateShow | null {
  const parsedDate = parseEventDate(setlist.eventDate)
  if (!parsedDate) return null

  const coords = setlist.venue?.city?.coords
  const lat = typeof coords?.lat === "number" ? coords.lat : null
  const lon = typeof coords?.long === "number" ? coords.long : null

  return {
    id: setlist.id,
    date: parsedDate.iso,
    venue: setlist.venue?.name ?? null,
    city: setlist.venue?.city?.name ?? null,
    country: setlist.venue?.city?.country?.name ?? null,
    headliner: setlist.artist.name,
    artistMbid: setlist.artist.mbid ?? null,
    lat,
    lon,
    setlistUrl: setlist.url ?? null,
    alreadyAdded: false,
    editPath: null,
  }
}

function composeHint(parsed: ParsedConcertQuery | null): string {
  if (!parsed) {
    return "Nothing found. Try naming the band, a city, or an approximate year."
  }

  const isFuzzy = isFuzzyArtistQuery(parsed)
  const hasPlace = Boolean(parsed.city || parsed.venue)

  if (isFuzzy && !hasPlace) {
    return 'Add a city or venue to narrow this down, e.g. "in Stuttgart last month".'
  }
  if (isFuzzy && !hasFuzzyDateAnchor(parsed)) {
    return 'Add a month or year to narrow this down, e.g. "last month" or "in 2024".'
  }
  if (isFuzzy) {
    const place = parsed.city
      ? ` in ${parsed.city}`
      : parsed.venue
        ? ` at ${parsed.venue}`
        : ""
    return `No Setlist.fm match${place} for that description. Try a different month or nearby city.`
  }

  if (!parsed.artist) {
    return "Tell me which band or artist you saw, or describe the show with a city and date."
  }
  const place = parsed.city ? ` in ${parsed.city}` : ""
  const yearLabel =
    parsed.yearStart != null
      ? parsed.yearEnd != null && parsed.yearEnd !== parsed.yearStart
        ? `${parsed.yearStart}–${parsed.yearEnd}`
        : `${parsed.yearStart}`
      : null

  if (!yearLabel && !parsed.city && !parsed.venue) {
    return `No matches for ${parsed.artist}. Add a city or an approximate year (e.g. "in 2010" or "summer '99").`
  }
  if (!yearLabel) {
    return `No matches for ${parsed.artist}${place}. Add an approximate year, e.g. "in 2010".`
  }
  if (!parsed.city && !parsed.venue) {
    return `No matches for ${parsed.artist} in ${yearLabel}. Add a city to narrow it down.`
  }
  return `No Setlist.fm match for ${parsed.artist}${place} in ${yearLabel}. Try a nearby city or a different year.`
}

/** True when search should run without pinning to a named artist. */
function isFuzzyArtistQuery(parsed: ParsedConcertQuery): boolean {
  if (!parsed.artist) return Boolean(parsed.artistHints)
  return isGenericArtistPhrase(parsed.artist)
}

/** Fuzzy mode requires a tight-enough date window to avoid city-wide result floods. */
function hasFuzzyDateAnchor(parsed: ParsedConcertQuery): boolean {
  if (parsed.month != null) return true
  if (parsed.season != null) return true
  if (parsed.yearStart == null && parsed.yearEnd == null) return false
  const a = parsed.yearStart ?? parsed.yearEnd!
  const b = parsed.yearEnd ?? parsed.yearStart!
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return hi - lo <= 1
}

/** Strip bogus generic artist names; preserve hints when moving artist -> artistHints. */
function effectiveParsedQuery(parsed: ParsedConcertQuery): ParsedConcertQuery {
  if (!parsed.artist || !isGenericArtistPhrase(parsed.artist)) {
    return parsed
  }
  return {
    ...parsed,
    artist: null,
    artistHints: parsed.artistHints ?? parsed.artist,
  }
}

/** Mark candidates that already exist in the user's list (date + headliner slug). */
async function markAlreadyAdded(
  candidates: CandidateShow[],
  userId: string
): Promise<void> {
  if (!candidates.length) return

  const slugs = [
    ...new Set(candidates.map((c) => slugify(c.headliner))),
  ].filter(Boolean)
  if (!slugs.length) return

  const times = candidates.map((c) => Date.parse(`${c.date}T00:00:00.000Z`))
  const minDate = new Date(Math.min(...times))
  const maxDate = new Date(Math.max(...times) + 24 * 60 * 60 * 1000 - 1)

  const existing = await prisma.userConcert.findMany({
    where: {
      userId,
      concert: {
        date: { gte: minDate, lte: maxDate },
        bands: {
          some: { isHeadliner: true, band: { slug: { in: slugs } } },
        },
      },
    },
    select: {
      concert: {
        select: {
          id: true,
          date: true,
          bands: {
            where: { isHeadliner: true },
            select: { band: { select: { slug: true } } },
          },
        },
      },
    },
  })

  const byKey = new Map<string, string>()
  for (const { concert } of existing) {
    const iso = concert.date.toISOString().slice(0, 10)
    for (const cb of concert.bands) {
      byKey.set(`${iso}|${cb.band.slug}`, concert.id)
    }
  }

  for (const c of candidates) {
    const concertId = byKey.get(`${c.date}|${slugify(c.headliner)}`)
    if (concertId) {
      c.alreadyAdded = true
      c.editPath = `/concerts/edit/${concertId}`
    }
  }
}

/**
 * Single-shot: parse prose -> Setlist.fm search -> candidate shows.
 * Never throws; returns an empty candidate list with a contextual hint on miss.
 */
export async function searchConcertCandidates(
  prose: string,
  userId: string
): Promise<ConcertAiSearchResponse> {
  const rawParsed = await parseConcertProse(prose)
  const parsed = rawParsed ? effectiveParsedQuery(rawParsed) : null

  // Need at least one anchor to search; otherwise results would be meaningless.
  if (
    !parsed ||
    (!parsed.artist && !parsed.artistHints && !parsed.city && !parsed.venue)
  ) {
    return { candidates: [], parsed, hint: composeHint(parsed) }
  }

  const fuzzy = isFuzzyArtistQuery(parsed)
  if (fuzzy) {
    if (!parsed.city && !parsed.venue) {
      return { candidates: [], parsed, hint: composeHint(parsed) }
    }
    if (!hasFuzzyDateAnchor(parsed)) {
      return { candidates: [], parsed, hint: composeHint(parsed) }
    }
  }

  // Pin the artist by MBID where possible (avoids unrelated-artist matches).
  const artistMbid =
    parsed.artist && !fuzzy ? await resolveArtistMbid(parsed.artist) : null

  const base = buildSearchBase(parsed, artistMbid)

  const { years, yearFilter } = planYears(parsed)

  let raw = await querySetlists(base, years)

  // When both city and venue are present, prefer a venue-only retry on miss —
  // Groq-inferred city names are often rejected by Setlist.fm (404).
  if (raw.length === 0 && base.cityName && base.venueName) {
    const { cityName: _city, ...venueOnly } = base
    raw = await querySetlists(venueOnly, years)
  }

  // Dedup by setlist id, map to candidates (drops unparseable dates).
  const seen = new Set<string>()
  let candidates: CandidateShow[] = []
  for (const setlist of raw) {
    if (seen.has(setlist.id)) continue
    seen.add(setlist.id)
    const candidate = toCandidate(setlist)
    if (candidate) candidates.push(candidate)
  }

  // Client-side filters: wide year range, season, month.
  if (yearFilter) {
    candidates = candidates.filter((c) => {
      const y = Number(c.date.slice(0, 4))
      return y >= yearFilter.lo && y <= yearFilter.hi
    })
  }
  if (parsed.month != null) {
    candidates = candidates.filter(
      (c) => Number(c.date.slice(5, 7)) === parsed.month
    )
  } else if (parsed.season) {
    const months = SEASON_MONTHS[parsed.season]
    candidates = candidates.filter((c) =>
      months.includes(Number(c.date.slice(5, 7)))
    )
  }

  // Re-rank fuzzy matches when multiple candidates share the same city/time window.
  if (fuzzy && parsed.artistHints && candidates.length > 1) {
    candidates = await rankCandidatesByHints(
      candidates,
      parsed.artistHints,
      prose
    )
  }

  // Most recent first, capped.
  candidates.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  candidates = candidates.slice(0, MAX_CANDIDATES)

  await markAlreadyAdded(candidates, userId)

  return {
    candidates,
    parsed,
    hint: candidates.length === 0 ? composeHint(parsed) : null,
  }
}

// ---------------------------------------------------------------------------
// One-click add: setlistId -> authoritative CreateConcertInput
// ---------------------------------------------------------------------------

export type BuildSetlistResultCode =
  | "NOT_FOUND"
  | "INVALID_DATE"
  | "MISSING_COORDINATES"

export type BuildSetlistResult =
  | {
      ok: true
      input: CreateConcertInput
      meta: { headliner: string; venue: string; dateIso: string }
    }
  | { ok: false; code: BuildSetlistResultCode }

/**
 * Resolve a coordinate pair for the venue.
 *
 * Setlist.fm only exposes city-centroid coords (and often none), which would
 * break the ~100m shared-concert dedup. So we prefer to forward-geocode the
 * venue (venue-precise, dedups against manually entered concerts), falling back
 * to the city centroid only when geocoding yields nothing.
 */
async function resolveCoords(
  setlist: SetlistfmSetlist
): Promise<{ lat: number; lon: number } | null> {
  const coords = setlist.venue?.city?.coords
  const centroidLat = typeof coords?.lat === "number" ? coords.lat : null
  const centroidLon = typeof coords?.long === "number" ? coords.long : null

  const venueName = setlist.venue?.name
  const cityName = setlist.venue?.city?.name
  const countryName = setlist.venue?.city?.country?.name

  if (isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING, true) && venueName) {
    const query = [venueName, cityName, countryName].filter(Boolean).join(", ")
    const results = await searchVenues(query, {
      lat: centroidLat ?? undefined,
      lon: centroidLon ?? undefined,
    })
    const top = results[0]
    if (top && typeof top.lat === "number" && typeof top.lon === "number") {
      return { lat: top.lat, lon: top.lon }
    }
  }

  if (centroidLat != null && centroidLon != null) {
    return { lat: centroidLat, lon: centroidLon }
  }
  return null
}

/**
 * Re-fetch a setlist by id and build the authoritative create input. The client
 * supplies only the setlistId; everything here is server-derived.
 */
export async function buildCreateInputFromSetlist(
  setlistId: string,
  userId: string
): Promise<BuildSetlistResult> {
  const setlist = await getSetlistById(setlistId)
  if (!setlist) return { ok: false, code: "NOT_FOUND" }

  const parsedDate = parseEventDate(setlist.eventDate)
  if (!parsedDate) return { ok: false, code: "INVALID_DATE" }

  const coords = await resolveCoords(setlist)
  if (!coords) return { ok: false, code: "MISSING_COORDINATES" }

  // Resolve the headliner to a canonical Band; enrich newly-created bands.
  const band = await getOrCreateBand(setlist.artist.name, userId)
  if (!band.imageEnrichedAt) {
    void enrichBandData(band.id, band.name)
  }

  const venue =
    setlist.venue?.name ?? setlist.venue?.city?.name ?? "Unknown venue"

  const input: CreateConcertInput = {
    userId,
    date: parsedDate.date,
    latitude: coords.lat,
    longitude: coords.lon,
    venue,
    // v1: support acts + festival flag are added later via the edit page.
    isFestival: false,
    bandIds: [{ bandId: band.id, isHeadliner: true }],
  }

  return {
    ok: true,
    input,
    meta: { headliner: setlist.artist.name, venue, dateIso: parsedDate.iso },
  }
}
