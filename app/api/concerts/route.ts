import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import {
  createConcert,
  getConcertsPaginated,
  type CreateConcertInput,
  type ConcertFilters,
} from "@/lib/concerts"
import { getOrCreateFestival } from "@/lib/festivals"
import { prisma } from "@/lib/prisma"
import type { GeocodingData } from "@/types/geocoding"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const cursor = searchParams.get("cursor") ?? undefined
  const limit = parseInt(searchParams.get("limit") || "20", 10)
  const direction = (searchParams.get("direction") || "forward") as
    | "forward"
    | "backward"

  // Extract filter parameters
  const userOnly = searchParams.get("userOnly") === "true"
  const userId = searchParams.get("userId") ?? undefined
  const username = searchParams.get("username") ?? undefined
  const bandSlug = searchParams.get("bandSlug") ?? undefined
  const yearParam = searchParams.get("year")
  const year = yearParam ? parseInt(yearParam, 10) : undefined

  // Build filters object
  const filters: ConcertFilters = {}

  // Handle userOnly (authenticated user's concerts)
  if (userOnly) {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    filters.userId = session.user.id
  }

  // Handle username filter (convert to userId, requires public profile)
  let publicProfileUser: { id: string; isPublic: boolean; hideLocationPublic: boolean; hideCostPublic: boolean } | null = null
  if (username) {
    publicProfileUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true, isPublic: true, hideLocationPublic: true, hideCostPublic: true },
    })

    if (!publicProfileUser || !publicProfileUser.isPublic) {
      return NextResponse.json(
        { error: "User not found or not public" },
        { status: 404 }
      )
    }

    filters.userId = publicProfileUser.id
    filters.isPublic = true
  }

  // Handle userId filter (for public profiles)
  if (userId && !userOnly) {
    filters.userId = userId
    filters.isPublic = true
  }

  // Handle bandSlug filter
  if (bandSlug) {
    filters.bandSlug = bandSlug
  }

  // Handle year filter
  if (year) {
    filters.year = year
  }

  // Handle city filter
  const city = searchParams.get("city") ?? undefined
  if (city) {
    filters.city = city
  }

  // Fetch paginated results with filters
  const result = await getConcertsPaginated(cursor, limit, direction, filters)

  // Strip hidden data from public profile responses (defense in depth)
  if (publicProfileUser) {
    const now = new Date().toISOString()
    result.items = result.items.map((item) => ({
      ...item,
      ...(publicProfileUser!.hideLocationPublic && {
        venue: null,
        city: { lat: 0, lon: 0 },
        fields: { geocoderAddressFields: { _normalized_city: "" } as GeocodingData },
        ...(item.date > now && { date: "" }),
      }),
      ...(publicProfileUser!.hideCostPublic && { cost: null }),
    }))
  }

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.venue || !body.latitude || !body.longitude) {
      return NextResponse.json(
        { error: "Venue, latitude, and longitude are required" },
        { status: 400 }
      )
    }

    // Resolve festival: use provided ID or create from name
    let resolvedFestivalId = body.festivalId
    if (body.isFestival && body.festivalName && !body.festivalId) {
      const festival = await getOrCreateFestival(body.festivalName)
      resolvedFestivalId = festival.id
    }

    const input: CreateConcertInput = {
      userId: session.user.id,
      date: new Date(body.date),
      latitude: body.latitude,
      longitude: body.longitude,
      venue: body.venue,
      isFestival: body.isFestival || false,
      festivalId: resolvedFestivalId,
      cost:
        body.cost !== undefined && body.cost !== null && body.cost !== ""
          ? parseFloat(body.cost)
          : undefined,
      bandIds: body.bandIds || [],
    }

    const concert = await createConcert(input)

    // Revalidate statistics cache
    revalidateTag("concert-statistics")

    return NextResponse.json(concert, { status: 201 })
  } catch (error) {
    console.error("Error creating concert:", error)
    return NextResponse.json(
      { error: "Failed to create concert" },
      { status: 500 }
    )
  }
}
