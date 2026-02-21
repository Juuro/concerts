/**
 * Photon API type definitions for venue search
 * Based on Komoot Photon API (https://photon.komoot.io)
 */

export interface PhotonSearchParams {
  q: string          // Search query
  limit?: number     // Max results (default 10)
  lat?: number       // Bias results near this latitude
  lon?: number       // Bias results near this longitude
  osm_tag?: string   // Filter by OSM tag (e.g., "amenity")
}

export interface PhotonSearchFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number] // [longitude, latitude]
  }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    state?: string
    country?: string
    osm_type?: string  // "node", "way", or "relation"
    osm_id?: number
    osm_key?: string
    osm_value?: string
    [key: string]: unknown
  }
}

export interface PhotonSearchResponse {
  type: "FeatureCollection"
  features: PhotonSearchFeature[]
}

export interface PhotonSearchResult {
  name: string          // Venue name
  displayName: string   // Formatted display address
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  state?: string
  country?: string
  lat: number
  lon: number
  osmType?: string
  osmId?: number
}
