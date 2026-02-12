/**
 * Photon Forward Geocoding Service
 * Provides venue search functionality using Komoot Photon API
 * Based on OpenStreetMap data
 */

import type {
  PhotonSearchParams,
  PhotonSearchResponse,
  PhotonSearchResult,
  PhotonSearchFeature,
} from "@/types/photon"

// Rate limiting configuration (same as reverse geocoding)
const PHOTON_MIN_REQUEST_INTERVAL = 700 // 700ms between requests
let photonLastRequestAt = 0
let photonQueue: Promise<void> = Promise.resolve()
const pendingPhotonRequests = new Map<string, Promise<PhotonSearchResult[]>>()

/**
 * Queue manager for Photon API requests
 * Ensures requests are serialized with minimum interval
 */
async function withPhotonQueue<T>(fn: () => Promise<T>): Promise<T> {
  const prev = photonQueue
  let releaseNext!: () => void
  photonQueue = new Promise<void>((resolve) => {
    releaseNext = resolve
  })
  await prev
  try {
    return await fn()
  } finally {
    releaseNext()
  }
}

/**
 * Format a display name from Photon feature properties
 * Creates a human-readable address string
 */
function formatDisplayName(props: PhotonSearchFeature["properties"]): string {
  const parts: string[] = []

  // Street address
  if (props.street) {
    let street = props.street
    if (props.housenumber) {
      street += ` ${props.housenumber}`
    }
    parts.push(street)
  }

  // City with postal code
  if (props.postcode && props.city) {
    parts.push(`${props.postcode} ${props.city}`)
  } else if (props.city) {
    parts.push(props.city)
  }

  // Country
  if (props.country) {
    parts.push(props.country)
  }

  return parts.join(", ")
}

/**
 * Fetch venue search results from Photon API
 * @param params Search parameters
 * @returns Array of venue search results
 */
async function fetchPhotonSearch(
  params: PhotonSearchParams
): Promise<PhotonSearchResult[]> {
  // Rate limiting: wait if needed
  const now = Date.now()
  const waitMs = Math.max(
    0,
    photonLastRequestAt + PHOTON_MIN_REQUEST_INTERVAL - now
  )
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
  photonLastRequestAt = Date.now()

  // Build API URL
  const baseUrl = process.env.PHOTON_BASE_URL || "https://photon.komoot.io"
  const url = new URL("/api/", baseUrl)
  url.searchParams.set("q", params.q)
  url.searchParams.set("limit", String(params.limit || 10))

  // Bias results near provided coordinates
  if (params.lat && params.lon) {
    url.searchParams.set("lat", String(params.lat))
    url.searchParams.set("lon", String(params.lon))
  }

  // Filter by OSM tag if provided
  if (params.osm_tag) {
    url.searchParams.set("osm_tag", params.osm_tag)
  }

  // Fetch results
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  })

  if (!res.ok) {
    console.error(`Photon search failed: ${res.status}`)
    return []
  }

  const json = (await res.json()) as PhotonSearchResponse

  // Transform features to search results
  return json.features.map((feature) => {
    const props = feature.properties
    const [lon, lat] = feature.geometry.coordinates

    return {
      name: props.name || props.street || "Unknown",
      displayName: formatDisplayName(props),
      street: props.street,
      housenumber: props.housenumber,
      postcode: props.postcode,
      city: props.city,
      state: props.state,
      country: props.country,
      lat,
      lon,
      osmType: props.osm_type,
      osmId: props.osm_id,
    }
  })
}

/**
 * Search for venues using Photon API
 * Includes request deduplication and rate limiting
 *
 * @param query Search query string (minimum 3 characters)
 * @param options Optional lat/lon to bias results
 * @returns Promise resolving to array of venue search results
 */
export async function searchVenues(
  query: string,
  options?: { lat?: number; lon?: number }
): Promise<PhotonSearchResult[]> {
  // Require minimum 3 characters
  if (query.length < 3) return []

  // Check for pending request with same parameters
  const cacheKey = `${query}:${options?.lat || ""}:${options?.lon || ""}`
  const existing = pendingPhotonRequests.get(cacheKey)
  if (existing) return existing

  // Create new request
  const promise = withPhotonQueue(() =>
    fetchPhotonSearch({
      q: query,
      limit: 10,
      ...options,
    })
  )

  // Store pending request for deduplication
  pendingPhotonRequests.set(cacheKey, promise)

  try {
    return await promise
  } finally {
    // Clean up after request completes
    pendingPhotonRequests.delete(cacheKey)
  }
}
