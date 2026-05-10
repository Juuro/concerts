import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchVenuesEnhanced } from "@/lib/venues"

// In-memory rate limiting (simple implementation)
// For production, consider using Upstash Redis or similar
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requests per minute
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const RATE_LIMIT_MAX_ENTRIES = 10000 // Cap to prevent unbounded growth

let lastCleanupAt = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(ip)
    }
  }
  lastCleanupAt = now
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()

  // Periodic cleanup of expired entries to prevent unbounded memory growth
  if (now - lastCleanupAt > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    cleanupExpiredEntries()
  }

  // Hard cap on map size as additional safeguard
  if (rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES && !rateLimitMap.has(ip)) {
    cleanupExpiredEntries()
    // If still at capacity after cleanup, allow request but don't track
    if (rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES) {
      return true
    }
  }

  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  entry.count++
  return true
}

/**
 * GET /api/venues/search
 * Search for event venues across multiple sources with intelligent ranking.
 *
 * Sources (in priority order):
 * 1. Database - User's concert history with personalized scoring
 * 2. Ticketmaster - Concert-specific venue database
 * 3. Photon/OpenStreetMap - General geocoding fallback
 *
 * Query parameters:
 * - q: Search query (required, 3-100 characters)
 * - lat: Latitude for biasing results (optional, -90 to 90)
 * - lon: Longitude for biasing results (optional, -180 to 180)
 *
 * Returns: Array of EnhancedVenueResult objects, sorted by relevance score
 *
 * Personalization fields (isUserVenue, userVisitCount) are only included
 * for authenticated users viewing their own venue history.
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"
  if (!checkRateLimit(ip)) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")?.trim()

  // Input validation: query length
  if (!query || query.length < 3) {
    return NextResponse.json([])
  }
  if (query.length > 100) {
    return NextResponse.json([])
  }

  // Parse and validate lat/lon
  const latStr = searchParams.get("lat")
  const lonStr = searchParams.get("lon")
  let lat: number | undefined
  let lon: number | undefined

  if (latStr) {
    lat = parseFloat(latStr)
    if (isNaN(lat) || lat < -90 || lat > 90) {
      lat = undefined // Ignore invalid lat
    }
  }

  if (lonStr) {
    lon = parseFloat(lonStr)
    if (isNaN(lon) || lon < -180 || lon > 180) {
      lon = undefined // Ignore invalid lon
    }
  }

  // Fallback: use Vercel's IP-based geolocation headers when no explicit
  // coordinates were provided. These are injected automatically in production.
  // Coordinates are used transiently for result biasing only — never stored or logged (GDPR).
  if (lat === undefined && lon === undefined) {
    const geoLat = parseFloat(request.headers.get("x-vercel-ip-latitude") || "")
    const geoLon = parseFloat(
      request.headers.get("x-vercel-ip-longitude") || ""
    )
    if (
      !isNaN(geoLat) &&
      geoLat >= -90 &&
      geoLat <= 90 &&
      !isNaN(geoLon) &&
      geoLon >= -180 &&
      geoLon <= 180
    ) {
      lat = geoLat
      lon = geoLon
    }
  }

  // Get authenticated user (optional - for personalized results)
  let userId: string | undefined
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    userId = session?.user?.id
  } catch {
    // Session lookup failed - continue without personalization
  }

  try {
    const results = await searchVenuesEnhanced(query, {
      userId,
      lat,
      lon,
    })
    return NextResponse.json(results)
  } catch (error) {
    Sentry.captureException(error)
    console.error("Venue search error:", error)
    return NextResponse.json(
      { error: "Failed to search venues" },
      { status: 500 }
    )
  }
}
