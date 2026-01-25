import contentfulClient from "./contentful";
import fs from "node:fs/promises";
import path from "node:path";
import opencage from "opencage-api-client";
import { isFeatureEnabled, FEATURE_FLAGS } from "./featureFlags";
import { getConcertFields, getBandFields, getFestivalFields, getCity } from "./contentfulHelpers";
import type { Concert, Band, SiteMetadata, ConcertsFormatted } from "../types/concert";
import type { GeocodingData, OpenCageComponents } from "../types/geocoding";
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
 * Normalize geocoding data to extract city name
 */
function normalizeCityName(components: OpenCageComponents): string {
  return (
    components._normalized_city ||
    components.city ||
    components.town ||
    components.village ||
    ""
  );
}

/**
 * Format coordinates as a string for display
 */
function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

/**
 * Fetch geocoding data for a location
 */
async function getGeocodingData(lat: number, lon: number): Promise<GeocodingData> {
  // Check feature flag first - if disabled, return coordinates as string
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING, true)) {
    return {
      _normalized_city: formatCoordinates(lat, lon),
      _is_coordinates: true,
    };
  }

  if (!process.env.OPENCAGE_API_KEY) {
    console.warn("OPENCAGE_API_KEY not set, skipping geocoding");
    return {
      _normalized_city: formatCoordinates(lat, lon),
      _is_coordinates: true,
    };
  }

  const query = `${lat}, ${lon}`;
  const apiRequestOptions = {
    key: process.env.OPENCAGE_API_KEY,
    q: query,
  };

  try {
    const data = await opencage.geocode(apiRequestOptions);
    if (data.status.code === 200 && data.results.length > 0) {
      const place = data.results[0];
      return {
        ...place.components,
        _normalized_city: normalizeCityName(place.components),
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  // Fallback to coordinates if geocoding fails
  return {
    _normalized_city: formatCoordinates(lat, lon),
    _is_coordinates: true,
  };
}

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
    club: fields.club,
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
