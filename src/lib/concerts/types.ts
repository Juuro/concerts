import type { GeocodingData } from "@/types/geocoding"

/** User-specific support act: bandId + sortOrder. Per-user, not shared. */
export type SupportingActItem = { bandId: string; sortOrder: number }

export interface TransformedBand {
  id: string
  name: string
  slug: string
  url: string
  imageUrl?: string | null
  websiteUrl?: string | null
  lastfm?: {
    url?: string | null
    genres?: string[]
    bio?: string | null
  } | null
  isHeadliner?: boolean
}

export interface TransformedConcert {
  id: string
  date: string
  city: {
    lat: number
    lon: number
  }
  venue?: string | null
  bands: TransformedBand[]
  isFestival: boolean
  festival: {
    fields: {
      name: string
      url?: string | null
    }
  } | null
  fields: {
    geocoderAddressFields: GeocodingData
  }
  // User-specific attendance data (included when filtering by user)
  attendance?: {
    id: string
    userId: string
    cost?: string | null
    notes?: string | null
  }
  // For social features
  attendeeCount?: number
  // DEPRECATED: For backward compatibility during transition
  userId?: string
  cost?: string | null
}

export interface CreateConcertInput {
  userId: string
  date: Date
  latitude: number
  longitude: number
  venue: string
  isFestival?: boolean
  festivalId?: string
  cost?: number
  bandIds: { bandId: string; isHeadliner?: boolean }[]
}

export interface UpdateConcertInput {
  // Shared concert data (any attendee can update)
  date?: Date
  latitude?: number
  longitude?: number
  venue?: string
  isFestival?: boolean
  festivalId?: string | null
  bandIds?: { bandId: string; isHeadliner?: boolean }[]
  // User-specific attendance data
  cost?: number | null
  notes?: string | null
}

export interface ConcertFilters {
  userId?: string // Filter by specific user
  bandSlug?: string // Filter by specific band
  year?: number // Filter by year
  city?: string // Filter by normalizedCity
  isPublic?: boolean // Only show public user concerts
}

export interface PaginatedConcerts {
  items: TransformedConcert[]
  /** Always a `concert.id` (same as `TransformedConcert.id`), including when filtering by `userId`. */
  nextCursor: string | null
  /** Always a `concert.id`. */
  prevCursor: string | null
  hasMore: boolean
  /**
   * For newest-first lists: whether there are concerts **more recent** than the first item
   * (used for the top “load more recent” control). For `direction: "backward"`, still means
   * whether another backward page exists.
   */
  hasPrevious: boolean
}

export interface ConcertCounts {
  past: number
  future: number
}

export interface ConcertStatistics {
  yearCounts: Array<[string, number, string]>
  cityCounts: Array<[string, number, string]>
  mostSeenBands: Array<[string, number, string]>
  maxYearCount: number
  maxCityCount: number
  maxBandCount: number
  totalPast: number
  totalFuture: number
}
