import { NextRequest, NextResponse } from "next/server"
import { searchVenues } from "@/utils/photon"

/**
 * GET /api/venues/search
 * Search for venues using Photon API
 *
 * Query parameters:
 * - q: Search query (required, min 3 characters)
 * - lat: Latitude for biasing results (optional)
 * - lon: Longitude for biasing results (optional)
 *
 * Returns: Array of PhotonSearchResult objects
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  // Require minimum 3 characters
  if (!query || query.length < 3) {
    return NextResponse.json([])
  }

  // Parse optional lat/lon for biasing results
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")

  const options =
    lat && lon
      ? {
          lat: parseFloat(lat),
          lon: parseFloat(lon),
        }
      : undefined

  try {
    const results = await searchVenues(query, options)
    return NextResponse.json(results)
  } catch (error) {
    console.error("Venue search error:", error)
    return NextResponse.json(
      { error: "Failed to search venues" },
      { status: 500 }
    )
  }
}
