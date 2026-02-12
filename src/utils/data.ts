import contentfulClient from "./contentful";
import fs from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { isFeatureEnabled, FEATURE_FLAGS } from "./featureFlags";
import { getConcertFields, getBandFields, getFestivalFields, getCity } from "./contentfulHelpers";
import type { Concert, Band, SiteMetadata, ConcertsFormatted } from "../types/concert";
import type { GeocodingData, PhotonReverseResponse } from "../types/geocoding";
import type { ContentfulConcertEntry, ContentfulBandEntry, ContentfulCity, ContentfulFestivalEntry, ContentfulConcertFields, ContentfulBandFields } from "../types/contentful";
import type { LastFMArtistInfoOrNull } from "../types/lastfm";

// Module-level cache for build-time data
// Prevents redundant API calls and data processing during static generation
interface Cache<T> {
  data: T | null;
  promise: Promise<T> | null;
}

const concertsCache: Cache<Concert[]> = { data: null, promise: null };
const bandsCache: Cache<Band[]> = { data: null, promise: null };

type LastfmCacheFile = {
  artists?: Record<string, LastFMArtistInfoOrNull>;
  generatedAt?: string;
  meta?: unknown;
};

let lastfmCachePromise: Promise<Map<string, LastFMArtistInfoOrNull>> | null = null;

function normalizeLastfmKey(name: string): string {
  return name.toLowerCase().trim();
}

type GeocodingCacheFile = {
  locations?: Record<string, GeocodingData>;
  generatedAt?: string;
  meta?: unknown;
};

let geocodingCachePromise: Promise<Map<string, GeocodingData>> | null = null;

async function loadLastfmCache(): Promise<Map<string, LastFMArtistInfoOrNull>> {
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true)) {
    return new Map();
  }

  if (lastfmCachePromise) return lastfmCachePromise;

  lastfmCachePromise = (async () => {
    const candidates = [
      path.join(process.cwd(), ".next", "cache", "lastfm-artists.json"),
      path.join(process.cwd(), ".cache", "lastfm-artists.json"),
    ];

    for (const filePath of candidates) {
      try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as LastfmCacheFile;
        const artists = parsed?.artists ?? {};
        return new Map(Object.entries(artists));
      } catch {
        // ignore missing/invalid cache file; fall back to next candidate
      }
    }

    return new Map();
  })();

  return lastfmCachePromise;
}

/**
 * Compute a stable cache key for a coordinate pair.
 */
function geocodingCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

/**
 * Format coordinates as a string for display
 */
function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

async function loadGeocodingCache(): Promise<Map<string, GeocodingData>> {
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING, true)) {
    return new Map();
  }

  if (geocodingCachePromise) return geocodingCachePromise;

  geocodingCachePromise = (async () => {
    const candidates = [
      path.join(process.cwd(), ".next", "cache", "geocoding.json"),
      path.join(process.cwd(), ".cache", "geocoding.json"),
    ];

    for (const filePath of candidates) {
      try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as GeocodingCacheFile;
        const locations = parsed?.locations ?? {};
        return new Map(Object.entries(locations));
      } catch {
        // ignore missing/invalid cache file; fall back to next candidate
      }
    }

    return new Map();
  })();

  return geocodingCachePromise;
}

const GEOCODING_MIN_REQUEST_INTERVAL = 700; // be polite: ~1.4 req/sec
const GEOCODING_GLOBAL_RATE_LIMIT_COOLDOWN = 60_000;
let geocodingLastRequestAt = 0;
let geocodingGlobalRateLimitUntil = 0;
let geocodingQueue: Promise<void> = Promise.resolve();
const pendingGeocodingRequests = new Map<string, Promise<GeocodingData | null>>();

async function fetchPhotonReverseGeocoding(lat: number, lon: number): Promise<GeocodingData | null> {
  // Avoid external calls outside development; build should rely on prefetch cache.
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  if (Date.now() < geocodingGlobalRateLimitUntil) {
    return null;
  }

  const now = Date.now();
  const waitMs = Math.max(0, geocodingLastRequestAt + GEOCODING_MIN_REQUEST_INTERVAL - now);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  geocodingLastRequestAt = Date.now();

  const baseUrl = process.env.PHOTON_BASE_URL || "https://photon.komoot.io";
  const url = new URL("/reverse", baseUrl);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (res.status === 429) {
      geocodingGlobalRateLimitUntil = Date.now() + GEOCODING_GLOBAL_RATE_LIMIT_COOLDOWN;
      return null;
    }

    if (!res.ok) return null;

    const json = (await res.json()) as PhotonReverseResponse;
    const first = Array.isArray(json?.features) ? json.features[0] : undefined;
    const props = first?.properties;

    const city =
      props?.city ||
      props?.locality ||
      props?.name ||
      props?.county ||
      props?.state ||
      "";

    if (typeof city === "string" && city.trim()) {
      return {
        _normalized_city: city.trim(),
        city: typeof props?.city === "string" ? props.city : undefined,
        locality: typeof props?.locality === "string" ? props.locality : undefined,
        name: typeof props?.name === "string" ? props.name : undefined,
        county: typeof props?.county === "string" ? props.county : undefined,
        state: typeof props?.state === "string" ? props.state : undefined,
        country: typeof props?.country === "string" ? props.country : undefined,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function withGeocodingQueue<T>(fn: () => Promise<T>): Promise<T> {
  const prev = geocodingQueue;
  let releaseNext!: () => void;
  geocodingQueue = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    releaseNext();
  }
}

async function fetchPhotonReverseGeocodingQueued(lat: number, lon: number): Promise<GeocodingData | null> {
  const key = geocodingCacheKey(lat, lon);
  const existing = pendingGeocodingRequests.get(key);
  if (existing) return existing;

  const promise = (async () => {
    // Serialize external calls to avoid bursts from Promise.all during dev.
    return await withGeocodingQueue(() => fetchPhotonReverseGeocoding(lat, lon));
  })();

  pendingGeocodingRequests.set(key, promise);
  try {
    return await promise;
  } finally {
    pendingGeocodingRequests.delete(key);
  }
}

/**
 * Fetch geocoding data for a location (uncached version)
 */
export async function getGeocodingDataUncached(lat: number, lon: number): Promise<GeocodingData> {
  // Check feature flag first - if disabled, return coordinates as string
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING, true)) {
    return {
      _normalized_city: formatCoordinates(lat, lon),
      _is_coordinates: true,
    };
  }

  const geocodingByCoord = await loadGeocodingCache();
  const cached = geocodingByCoord.get(geocodingCacheKey(lat, lon));
  if (cached && cached._normalized_city && !cached._is_coordinates) {
    return cached;
  }

  // If the cache is missing or is a fallback, try Photon live (dev only) with global pacing.
  const live = await fetchPhotonReverseGeocodingQueued(lat, lon);
  if (live && live._normalized_city) {
    return live;
  }

  // Fallback to coordinates if geocoding fails
  return {
    _normalized_city: formatCoordinates(lat, lon),
    _is_coordinates: true,
  };
}

/**
 * Fetch geocoding data for a location (cached via Next.js unstable_cache)
 */
export const getGeocodingData = unstable_cache(
  async (lat: number, lon: number): Promise<GeocodingData> => {
    return getGeocodingDataUncached(lat, lon);
  },
  ["geocoding"],
  { revalidate: 604800 }
);

/**
 * Transform Contentful concert entry to match expected format
 */
async function transformConcert(entry: ContentfulConcertEntry): Promise<Concert> {
  const fields = getConcertFields(entry);
  const city = getCity(fields);
  const geocodingData = await getGeocodingData(
    city.lat,
    city.lon
  );

  const lastfmByArtist = await loadLastfmCache();

  const bands: ContentfulBandEntry[] = (fields.bands as ContentfulBandEntry[] | undefined) || [];
  const bandsFormatted = await Promise.all(
    bands.map(async (band: ContentfulBandEntry) => {
      const bandFields = getBandFields(band);
      const lastfm = lastfmByArtist.get(normalizeLastfmKey(bandFields.name)) ?? null;
      return {
        id: band.sys.id,
        name: bandFields.name,
        slug: bandFields.slug,
        url: `/band/${bandFields.slug}/`,
        image: bandFields.image,
        lastfm,
      };
    })
  );

  // Transform festival if it exists
  const festival = fields.festival
    ? (() => {
        const festivalFields = getFestivalFields(fields.festival);
        return {
          fields: {
            name: festivalFields.name,
            url: festivalFields.url,
          },
        };
      })()
    : null;

  return {
    id: entry.sys.id,
    date: fields.date,
    city: city,
    venue: fields.club,
    bands: bandsFormatted,
    isFestival: fields.isFestival || false,
    festival: festival,
    fields: {
      geocoderAddressFields: geocodingData,
    },
  };
}

/**
 * Fetch all concerts from Contentful
 * Note: Next.js automatically caches fetch requests during build time
 * This function adds additional caching to prevent redundant processing
 */
export async function getAllConcerts(): Promise<Concert[]> {
  // Return cached data if available
  if (concertsCache.data) {
    return concertsCache.data;
  }

  // If already fetching, wait for that promise
  if (concertsCache.promise) {
    return concertsCache.promise;
  }

  // Start fetching and cache the promise
  concertsCache.promise = (async (): Promise<Concert[]> => {
    try {
      const entries = await contentfulClient.getEntries({
        content_type: "concert",
        order: ["-fields.date"],
        limit: 1000,
      });

      const concerts = await Promise.all(
        entries.items.map((entry) => transformConcert(entry as ContentfulConcertEntry))
      );

      concertsCache.data = concerts;
      return concerts;
    } catch (error: any) {
      concertsCache.promise = null; // Reset on error
      console.error("Error fetching concerts from Contentful:", error);
      if (error.message?.includes("Missing required")) {
        throw error; // Re-throw configuration errors
      }
      console.warn("Returning empty array due to fetch error");
      return [];
    }
  })();

  return concertsCache.promise;
}

/**
 * Fetch all bands from Contentful
 * Note: Next.js automatically caches fetch requests during build time
 * This function adds additional caching and optimizes concert grouping
 */
export async function getAllBands(): Promise<Band[]> {
  // Return cached data if available
  if (bandsCache.data) {
    return bandsCache.data;
  }

  // If already fetching, wait for that promise
  if (bandsCache.promise) {
    return bandsCache.promise;
  }

  // Start fetching and cache the promise
  bandsCache.promise = (async (): Promise<Band[]> => {
    try {
      // Fetch concerts once - uses cache if already fetched
      const allConcerts = await getAllConcerts();
      const lastfmByArtist = await loadLastfmCache();

      // Group concerts by band slug for O(1) lookup
      const concertsByBandSlug = new Map<string, Concert[]>();
      allConcerts.forEach((concert) => {
        concert.bands.forEach((band) => {
          if (!concertsByBandSlug.has(band.slug)) {
            concertsByBandSlug.set(band.slug, []);
          }
          concertsByBandSlug.get(band.slug)!.push(concert);
        });
      });

      // Fetch bands from Contentful
      const entries = await contentfulClient.getEntries({
        content_type: "band",
        order: ["fields.name"],
        limit: 1000,
      });

      const bands = await Promise.all(
        entries.items
          .filter((entry) => {
            const fields = getBandFields(entry as ContentfulBandEntry);
            return fields.slug !== "data-schema";
          })
          .map(async (entry) => {
            const bandEntry = entry as ContentfulBandEntry;
            const bandFields = getBandFields(bandEntry);
            const lastfm = lastfmByArtist.get(normalizeLastfmKey(bandFields.name)) ?? null;

            // Use pre-grouped concerts instead of calling getConcertsByBand()
            const concerts = concertsByBandSlug.get(bandFields.slug) || [];

            return {
              id: bandEntry.sys.id,
              name: bandFields.name,
              slug: bandFields.slug,
              url: `/band/${bandFields.slug}/`,
              image: bandFields.image,
              lastfm,
              concert: concerts,
            };
          })
      );

      bandsCache.data = bands;
      return bands;
    } catch (error: any) {
      bandsCache.promise = null; // Reset on error
      console.error("Error fetching bands from Contentful:", error);
      if (error.message?.includes("Missing required")) {
        throw error; // Re-throw configuration errors
      }
      console.warn("Returning empty array due to fetch error");
      return [];
    }
  })();

  return bandsCache.promise;
}

/**
 * Fetch concerts by band slug
 */
export async function getConcertsByBand(slug: string): Promise<Concert[]> {
  const allConcerts = await getAllConcerts();
  return allConcerts.filter((concert) =>
    concert.bands.some((band) => band.slug === slug)
  );
}

/**
 * Fetch concerts by year
 */
export async function getConcertsByYear(year: string | number): Promise<Concert[]> {
  const allConcerts = await getAllConcerts();
  const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
  const yearStart = new Date(yearNum, 0, 1);
  const yearEnd = new Date(yearNum, 11, 31, 23, 59, 59, 999);

  return allConcerts.filter((concert) => {
    const concertDate = new Date(concert.date);
    return concertDate >= yearStart && concertDate <= yearEnd;
  });
}

/**
 * Fetch concerts by city
 */
export async function getConcertsByCity(cityName: string): Promise<Concert[]> {
  const allConcerts = await getAllConcerts();
  return allConcerts.filter((concert) => {
    const city = concert.fields.geocoderAddressFields?._normalized_city;
    return city === cityName;
  });
}

/**
 * Get all unique years from concerts
 */
export async function getAllYears(): Promise<string[]> {
  const allConcerts = await getAllConcerts();
  const now = new Date();
  const years = new Set<string>();

  allConcerts.forEach((concert) => {
    const concertDate = new Date(concert.date);
    if (concertDate < now) {
      years.add(concertDate.getFullYear().toString());
    }
  });

  return Array.from(years).sort();
}

/**
 * Get all unique cities from concerts
 */
export async function getAllCities(): Promise<string[]> {
  const allConcerts = await getAllConcerts();
  const cities = new Set<string>();

  allConcerts.forEach((concert) => {
    const cityName = concert.fields.geocoderAddressFields?._normalized_city;
    if (cityName) {
      cities.add(cityName);
    }
  });

  return Array.from(cities).sort();
}

/**
 * Get site metadata
 */
export function getSiteMetadata(): SiteMetadata {
  return {
    title: "Concerts",
    description:
      "List of all concerts and festivals I've visited. Including pages for every band I ever saw.",
    author: "@juuro",
  };
}
