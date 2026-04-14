/**
 * Venue search module with multi-source support and intelligent ranking.
 *
 * Sources (in priority order):
 * 1. Database - User's concert history with personalized scoring
 * 2. Ticketmaster - Concert-specific venue database
 * 3. Photon - General OpenStreetMap geocoding
 */

import * as Sentry from "@sentry/nextjs"
import { prisma } from "@/lib/prisma"
import { searchVenues } from "@/utils/photon"
import { searchTicketmasterVenues } from "@/utils/ticketmaster"
import { haversineDistance } from "@/utils/helpers"
import type { EnhancedVenueResult, VenueSource } from "@/types/photon"

/**
 * Location coordinates for proximity calculations
 */
interface Location {
  latitude: number
  longitude: number
}

/**
 * Search options for enhanced venue search
 */
interface SearchOptions {
  userId?: string
  lat?: number
  lon?: number
}

/**
 * Wrap a promise with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  let timeoutId: NodeJS.Timeout
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch {
    clearTimeout(timeoutId!)
    return fallback
  }
}

/**
 * Search venues from database scoped to a specific user's concert history.
 * Returns only venues from concerts the user has attended.
 *
 * @param query - Search query string
 * @param userId - User ID to scope results to. Returns empty if not provided.
 * @param limit - Maximum results (default 10)
 * @returns Array of venue results with scores
 */
export async function searchDatabaseVenues(
  query: string,
  userId?: string,
  limit = 10
): Promise<EnhancedVenueResult[]> {
  if (query.length < 3 || !userId) {
    return []
  }

  type DbVenueRow = {
    venue: string
    latitude: number
    longitude: number
    normalizedCity: string | null
    user_count: bigint
    similarity: number
  }

  function mapResults(results: DbVenueRow[]): EnhancedVenueResult[] {
    return results.map((row) => {
      const userVisitCount = Number(row.user_count)
      const similarityBonus = Math.round(Number(row.similarity) * 50)

      const score = 150 + userVisitCount * 100 + similarityBonus

      return {
        name: row.venue,
        displayName: row.normalizedCity
          ? `${row.venue}, ${row.normalizedCity}`
          : row.venue,
        lat: row.latitude,
        lon: row.longitude,
        city: row.normalizedCity || undefined,
        source: "database" as VenueSource,
        isUserVenue: true,
        userVisitCount,
        score,
      }
    })
  }

  // Try fuzzy matching first (requires pg_trgm extension).
  // Falls back to ILIKE-only if pg_trgm is not available.
  try {
    const results = await prisma.$queryRaw<DbVenueRow[]>`
      SELECT
        c.venue,
        c.latitude,
        c.longitude,
        c."normalizedCity",
        COUNT(DISTINCT uc.id) as user_count,
        word_similarity(${query}, c.venue) as similarity
      FROM concert c
      JOIN user_concert uc ON uc."concertId" = c.id
      WHERE c.venue IS NOT NULL
        AND uc."userId" = ${userId}
        AND (
          c.venue ILIKE ${"%" + query + "%"}
          OR word_similarity(${query}, c.venue) > ${0.3}
        )
      GROUP BY c.venue, c.latitude, c.longitude, c."normalizedCity"
      ORDER BY
        CASE WHEN c.venue ILIKE ${"%" + query + "%"} THEN 0 ELSE 1 END,
        word_similarity(${query}, c.venue) DESC,
        COUNT(DISTINCT uc.id) DESC
      LIMIT ${limit}
    `
    return mapResults(results)
  } catch {
    // word_similarity() failed — pg_trgm extension likely not available.
    // Fall back to ILIKE-only query so database results still appear.
  }

  try {
    const results = await prisma.$queryRaw<DbVenueRow[]>`
      SELECT
        c.venue,
        c.latitude,
        c.longitude,
        c."normalizedCity",
        COUNT(DISTINCT uc.id) as user_count,
        0::float as similarity
      FROM concert c
      JOIN user_concert uc ON uc."concertId" = c.id
      WHERE c.venue IS NOT NULL
        AND uc."userId" = ${userId}
        AND c.venue ILIKE ${"%" + query + "%"}
      GROUP BY c.venue, c.latitude, c.longitude, c."normalizedCity"
      ORDER BY COUNT(DISTINCT uc.id) DESC
      LIMIT ${limit}
    `
    return mapResults(results)
  } catch (error) {
    Sentry.captureException(error, {
      extra: { userId: userId || "anonymous", limit },
    })
    console.error("Database venue search failed")
    return []
  }
}

/**
 * Get user's visited locations for proximity scoring.
 *
 * @param userId - User ID to fetch locations for
 * @returns Array of unique locations (deduplicated)
 */
export async function getUserVisitedLocations(
  userId: string
): Promise<Location[]> {
  const concerts = await prisma.concert.findMany({
    where: {
      attendees: {
        some: {
          userId,
        },
      },
    },
    select: {
      latitude: true,
      longitude: true,
    },
    distinct: ["latitude", "longitude"],
  })

  // Return unique locations
  return concerts.map((c) => ({
    latitude: c.latitude,
    longitude: c.longitude,
  }))
}

/**
 * Apply proximity scoring to venues based on user's visited locations.
 * Venues closer to places the user has visited get higher scores.
 *
 * Note: Database venues are skipped because they already have personalized
 * scoring based on user visit history.
 *
 * @param venues - Venues to score
 * @param userLocations - User's visited locations
 * @returns Venues with updated scores
 */
function applyProximityScoring(
  venues: EnhancedVenueResult[],
  userLocations: Location[]
): EnhancedVenueResult[] {
  if (userLocations.length === 0) {
    return venues
  }

  return venues.map((venue) => {
    // Skip database venues - they already have personalized scoring
    if (venue.source === "database") {
      return venue
    }

    // Find minimum distance to any user-visited location
    const minDistance = Math.min(
      ...userLocations.map((loc) =>
        haversineDistance(venue.lat, venue.lon, loc.latitude, loc.longitude)
      )
    )

    // Add proximity bonus: +50 at 0km, +0 at 50km+
    const proximityBonus = Math.max(0, 50 - minDistance)

    return {
      ...venue,
      score: (venue.score || 0) + proximityBonus,
    }
  })
}

/**
 * Deduplicate venues by name and coordinates.
 * When duplicates are found, keep the one with the higher score.
 *
 * @param venues - Venues to deduplicate
 * @returns Deduplicated venues
 */
function deduplicateVenues(
  venues: EnhancedVenueResult[]
): EnhancedVenueResult[] {
  const seen = new Map<string, EnhancedVenueResult>()

  for (const venue of venues) {
    // Key: lowercase name + rounded coords (3 decimals ≈ 100m precision)
    const key = `${venue.name.toLowerCase()}:${venue.lat.toFixed(3)}:${venue.lon.toFixed(3)}`

    const existing = seen.get(key)
    if (!existing || (venue.score || 0) > (existing.score || 0)) {
      seen.set(key, venue)
    }
  }

  return Array.from(seen.values())
}

/**
 * Strip user-specific fields from venue results.
 * Used when returning results to unauthenticated users or for non-DB results.
 *
 * @param venue - Venue to sanitize
 * @returns Venue without user-specific fields
 */
function stripUserFields(venue: EnhancedVenueResult): EnhancedVenueResult {
  const { isUserVenue, userVisitCount, ...publicFields } = venue
  return publicFields
}

/**
 * Search all venue sources in parallel, merge, dedupe, and rank results.
 *
 * @param query - Search query string (minimum 3 characters)
 * @param options - Optional search options (userId, lat, lon)
 * @returns Array of enhanced venue results, sorted by score
 */
export async function searchVenuesEnhanced(
  query: string,
  options?: SearchOptions
): Promise<EnhancedVenueResult[]> {
  if (query.length < 3) {
    return []
  }

  const { userId, lat, lon } = options || {}

  // Get user's visited locations for proximity scoring (if authenticated)
  const userLocationsPromise = userId
    ? getUserVisitedLocations(userId)
    : Promise.resolve([])

  // Search all 3 sources in parallel with individual timeouts
  const [dbResult, tmResult, photonResult, userLocations] = await Promise.all([
    withTimeout(searchDatabaseVenues(query, userId), 3000, []),
    withTimeout(searchTicketmasterVenues(query, { lat, lon }), 3000, []),
    withTimeout(
      searchVenues(
        query,
        lat !== undefined && lon !== undefined ? { lat, lon } : undefined
      ),
      5000,
      []
    ),
    withTimeout(userLocationsPromise, 2000, []),
  ])

  // Collect all results
  const allResults: EnhancedVenueResult[] = []

  // Add database results (already have scores and user info)
  allResults.push(...dbResult)

  // Add Ticketmaster results (already have base score of 30)
  allResults.push(...tmResult)

  // Transform Photon results to EnhancedVenueResult
  const photonEnhanced = photonResult.map((r) => ({
    ...r,
    source: "photon" as VenueSource,
    score: 10, // Base score for Photon results
  }))
  allResults.push(...photonEnhanced)

  // Deduplicate by name + coordinates
  const deduped = deduplicateVenues(allResults)

  // Apply proximity scoring to non-DB results
  const scored = applyProximityScoring(deduped, userLocations)

  // Sort by score descending
  scored.sort((a, b) => (b.score || 0) - (a.score || 0))

  // SECURITY: Strip user-specific fields for non-authenticated requests
  // or for results that aren't from the user's own database
  const sanitized = scored.map((venue) => {
    // Only include user-specific fields for authenticated user's DB results
    if (userId && venue.source === "database" && venue.isUserVenue) {
      return venue
    }
    return stripUserFields(venue)
  })

  // Return top 10 results
  return sanitized.slice(0, 10)
}
