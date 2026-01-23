import contentfulClient from "./contentful"
import { getArtistInfo } from "./lastfm"
import opencage from "opencage-api-client"
import { isFeatureEnabled, FEATURE_FLAGS } from "./featureFlags"

// Module-level cache for build-time data
// Prevents redundant API calls and data processing during static generation
const concertsCache = { data: null, promise: null }
const bandsCache = { data: null, promise: null }

/**
 * Normalize geocoding data to extract city name
 */
function normalizeCityName(components) {
  return (
    components._normalized_city ||
    components.city ||
    components.town ||
    components.village ||
    ""
  )
}

/**
 * Format coordinates as a string for display
 */
function formatCoordinates(lat, lon) {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`
}

/**
 * Fetch geocoding data for a location
 */
async function getGeocodingData(lat, lon) {
  // Check feature flag first - if disabled, return coordinates as string
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING, true)) {
    return {
      _normalized_city: formatCoordinates(lat, lon),
      _is_coordinates: true,
    }
  }

  if (!process.env.OPENCAGE_API_KEY) {
    console.warn("OPENCAGE_API_KEY not set, skipping geocoding")
    return {
      _normalized_city: formatCoordinates(lat, lon),
      _is_coordinates: true,
    }
  }

  const query = `${lat}, ${lon}`
  const apiRequestOptions = {
    key: process.env.OPENCAGE_API_KEY,
    q: query,
  }

  try {
    const data = await opencage.geocode(apiRequestOptions)
    if (data.status.code === 200 && data.results.length > 0) {
      const place = data.results[0]
      return {
        ...place.components,
        _normalized_city: normalizeCityName(place.components),
      }
    }
  } catch (error) {
    console.error("Geocoding error:", error)
  }

  // Fallback to coordinates if geocoding fails
  return {
    _normalized_city: formatCoordinates(lat, lon),
    _is_coordinates: true,
  }
}

/**
 * Transform Contentful concert entry to match expected format
 */
async function transformConcert(entry) {
  const geocodingData = await getGeocodingData(
    entry.fields.city.lat,
    entry.fields.city.lon
  )

  // Fetch Last.fm data for each band (only if feature flag is enabled)
  const bandsWithLastfm = await Promise.all(
    (entry.fields.bands || []).map(async (band) => {
      const lastfmData = isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true)
        ? await getArtistInfo(band.fields.name)
        : null
      return {
        id: band.sys.id,
        name: band.fields.name,
        slug: band.fields.slug,
        url: `/band/${band.fields.slug}/`,
        image: band.fields.image,
        fields: {
          lastfm: lastfmData,
        },
      }
    })
  )

  return {
    id: entry.sys.id,
    date: entry.fields.date,
    city: entry.fields.city,
    club: entry.fields.club,
    bands: bandsWithLastfm,
    isFestival: entry.fields.isFestival || false,
    festival: entry.fields.festival || null,
    fields: {
      geocoderAddressFields: geocodingData,
    },
  }
}

/**
 * Fetch all concerts from Contentful
 * Note: Next.js automatically caches fetch requests during build time
 * This function adds additional caching to prevent redundant processing
 */
export async function getAllConcerts() {
  // Return cached data if available
  if (concertsCache.data) {
    return concertsCache.data
  }

  // If already fetching, wait for that promise
  if (concertsCache.promise) {
    return concertsCache.promise
  }

  // Start fetching and cache the promise
  concertsCache.promise = (async () => {
    try {
      const entries = await contentfulClient.getEntries({
        content_type: "concert",
        order: "-fields.date",
        limit: 1000,
      })

      const concerts = await Promise.all(
        entries.items.map((entry) => transformConcert(entry))
      )

      concertsCache.data = concerts
      return concerts
    } catch (error) {
      concertsCache.promise = null // Reset on error
      console.error("Error fetching concerts from Contentful:", error)
      if (error.message?.includes("Missing required")) {
        throw error // Re-throw configuration errors
      }
      console.warn("Returning empty array due to fetch error")
      return []
    }
  })()

  return concertsCache.promise
}

/**
 * Fetch all bands from Contentful
 * Note: Next.js automatically caches fetch requests during build time
 * This function adds additional caching and optimizes concert grouping
 */
export async function getAllBands() {
  // Return cached data if available
  if (bandsCache.data) {
    return bandsCache.data
  }

  // If already fetching, wait for that promise
  if (bandsCache.promise) {
    return bandsCache.promise
  }

  // Start fetching and cache the promise
  bandsCache.promise = (async () => {
    try {
      // Fetch concerts once - uses cache if already fetched
      const allConcerts = await getAllConcerts()

      // Group concerts by band slug for O(1) lookup
      const concertsByBandSlug = new Map()
      allConcerts.forEach((concert) => {
        concert.bands.forEach((band) => {
          if (!concertsByBandSlug.has(band.slug)) {
            concertsByBandSlug.set(band.slug, [])
          }
          concertsByBandSlug.get(band.slug).push(concert)
        })
      })

      // Fetch bands from Contentful
      const entries = await contentfulClient.getEntries({
        content_type: "band",
        order: "fields.name",
        limit: 1000,
      })

      const bands = await Promise.all(
        entries.items
          .filter((entry) => {
            return entry.fields.slug !== "data-schema"
          })
          .map(async (entry) => {
            const lastfmData = isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true)
              ? await getArtistInfo(entry.fields.name)
              : null

            // Use pre-grouped concerts instead of calling getConcertsByBand()
            const concerts = concertsByBandSlug.get(entry.fields.slug) || []

            return {
              id: entry.sys.id,
              name: entry.fields.name,
              slug: entry.fields.slug,
              url: `/band/${entry.fields.slug}/`,
              image: entry.fields.image,
              lastfm: lastfmData,
              concert: concerts,
            }
          })
      )

      bandsCache.data = bands
      return bands
    } catch (error) {
      bandsCache.promise = null // Reset on error
      console.error("Error fetching bands from Contentful:", error)
      if (error.message?.includes("Missing required")) {
        throw error // Re-throw configuration errors
      }
      console.warn("Returning empty array due to fetch error")
      return []
    }
  })()

  return bandsCache.promise
}

/**
 * Fetch concerts by band slug
 */
export async function getConcertsByBand(slug) {
  const allConcerts = await getAllConcerts()
  return allConcerts.filter((concert) =>
    concert.bands.some((band) => band.slug === slug)
  )
}

/**
 * Fetch concerts by year
 */
export async function getConcertsByYear(year) {
  const allConcerts = await getAllConcerts()
  const yearNum = parseInt(year, 10)
  const yearStart = new Date(yearNum, 0, 1)
  const yearEnd = new Date(yearNum, 11, 31, 23, 59, 59, 999)

  return allConcerts.filter((concert) => {
    const concertDate = new Date(concert.date)
    return concertDate >= yearStart && concertDate <= yearEnd
  })
}

/**
 * Fetch concerts by city
 */
export async function getConcertsByCity(cityName) {
  const allConcerts = await getAllConcerts()
  return allConcerts.filter((concert) => {
    const city = concert.fields.geocoderAddressFields?._normalized_city
    return city === cityName
  })
}

/**
 * Get all unique years from concerts
 */
export async function getAllYears() {
  const allConcerts = await getAllConcerts()
  const now = new Date()
  const years = new Set()

  allConcerts.forEach((concert) => {
    const concertDate = new Date(concert.date)
    if (concertDate < now) {
      years.add(concertDate.getFullYear().toString())
    }
  })

  return Array.from(years).sort()
}

/**
 * Get all unique cities from concerts
 */
export async function getAllCities() {
  const allConcerts = await getAllConcerts()
  const cities = new Set()

  allConcerts.forEach((concert) => {
    const cityName = concert.fields.geocoderAddressFields?._normalized_city
    if (cityName) {
      cities.add(cityName)
    }
  })

  return Array.from(cities).sort()
}

/**
 * Get site metadata
 */
export function getSiteMetadata() {
  return {
    title: "Concerts",
    description:
      "List of all concerts and festivals I've visited. Including pages for every band I ever saw.",
    author: "@juuro",
  }
}
