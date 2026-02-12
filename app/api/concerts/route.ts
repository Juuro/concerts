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
import { prisma } from "@/lib/prisma"

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
  const city = searchParams.get("city") ?? undefined
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
  if (username) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, isPublic: true },
    })

    if (!user || !user.isPublic) {
      return NextResponse.json(
        { error: "User not found or not public" },
        { status: 404 }
      )
    }

    filters.userId = user.id
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

  // Handle city filter
  if (city) {
    filters.city = city
  }

  // Handle year filter
  if (year) {
    filters.year = year
  }

  // Fetch paginated results with filters
  const result = await getConcertsPaginated(cursor, limit, direction, filters)
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

    const input: CreateConcertInput = {
      userId: session.user.id,
      date: new Date(body.date),
      latitude: body.latitude,
      longitude: body.longitude,
      venue: body.venue,
      isFestival: body.isFestival || false,
      festivalId: body.festivalId,
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
