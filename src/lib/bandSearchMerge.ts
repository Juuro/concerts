import { unstable_cache } from "next/cache"
import { searchBands, type TransformedBand } from "@/lib/bands"
import { isFeatureEnabled, FEATURE_FLAGS } from "@/utils/featureFlags"
import { searchMusicBrainzArtists } from "@/utils/musicbrainz"
import { searchLastFmArtists } from "@/utils/lastfm"
import type { BandSearchResultItem } from "@/types/bandSearch"
import { normalizeBandSearchKey } from "@/utils/bandSearchNormalize"

const fetchExternalBandSuggestionsCached = unstable_cache(
  async (
    normalizedQuery: string,
    mbCap: number,
    lfCap: number,
    lastfmEnabledKey: string
  ) => {
    const mb = await searchMusicBrainzArtists(normalizedQuery, mbCap)
    const lf =
      lastfmEnabledKey === "1"
        ? await searchLastFmArtists(normalizedQuery, lfCap)
        : []
    return { mb, lf }
  },
  ["band-search-external-suggestions"],
  { revalidate: 120 }
)

async function loadExternalSuggestions(
  normalizedQuery: string,
  mbCap: number,
  lfCap: number
): Promise<{
  mb: { mbid: string; name: string }[]
  lf: { name: string; listeners?: number }[]
}> {
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_EXTERNAL_BAND_SUGGEST, false)) {
    return { mb: [], lf: [] }
  }
  const lastfmKey = isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true)
    ? "1"
    : "0"
  return fetchExternalBandSuggestionsCached(
    normalizedQuery,
    mbCap,
    lfCap,
    lastfmKey
  )
}

export function mergeBandSearchResults(
  dbBands: Omit<TransformedBand, "concert">[],
  external: {
    mb: { mbid: string; name: string }[]
    lf: { name: string; listeners?: number }[]
  },
  limit: number
): BandSearchResultItem[] {
  const seen = new Set<string>()
  const out: BandSearchResultItem[] = []

  for (const b of dbBands) {
    const key = normalizeBandSearchKey(b.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind: "db", ...b })
    if (out.length >= limit) return out
  }

  for (const a of external.mb) {
    const key = normalizeBandSearchKey(a.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      kind: "suggestion",
      name: a.name,
      source: "musicbrainz",
      externalId: a.mbid,
    })
    if (out.length >= limit) return out
  }

  for (const a of external.lf) {
    const key = normalizeBandSearchKey(a.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      kind: "suggestion",
      name: a.name,
      source: "lastfm",
    })
    if (out.length >= limit) return out
  }

  return out
}

export async function searchBandsWithSuggestions(
  query: string,
  limit: number
): Promise<BandSearchResultItem[]> {
  const trimmed = query.trim()
  const capped = Math.min(Math.max(limit, 1), 50)
  const dbBands = await searchBands(trimmed, capped)

  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_EXTERNAL_BAND_SUGGEST, false)) {
    return dbBands.map((b) => ({ kind: "db" as const, ...b }))
  }

  const key = normalizeBandSearchKey(trimmed)
  const external = await loadExternalSuggestions(key, capped, capped)
  return mergeBandSearchResults(dbBands, external, capped)
}
