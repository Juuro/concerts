import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getGeocodingData } from "@/utils/data"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const concert = await prisma.concert.findUnique({
      where: { id },
      select: {
        id: true,
        venue: true,
        latitude: true,
        longitude: true,
        normalizedCity: true,
      },
    })

    if (!concert) {
      return NextResponse.json({ error: "Concert not found" }, { status: 404 })
    }

    if (concert.latitude === null || concert.longitude === null) {
      return NextResponse.json(
        { error: "Concert has no coordinates" },
        { status: 400 }
      )
    }

    // Get geocoding data
    const geocodingData = await getGeocodingData(
      concert.latitude,
      concert.longitude
    )

    const normalizedCity =
      geocodingData?._normalized_city && !geocodingData._is_coordinates
        ? geocodingData._normalized_city
        : null

    // Update the concert
    await prisma.concert.update({
      where: { id },
      data: { normalizedCity },
    })

    // Log the admin activity
    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "concert_geocode",
        targetType: "concert",
        targetId: id,
        details: {
          venue: concert.venue,
          coordinates: { lat: concert.latitude, lng: concert.longitude },
          previousCity: concert.normalizedCity,
          newCity: normalizedCity,
        },
      },
    })

    return NextResponse.json({
      success: true,
      concertId: id,
      normalizedCity,
    })
  } catch (error) {
    console.error("Error geocoding concert:", error)
    return NextResponse.json(
      { error: "Failed to geocode concert" },
      { status: 500 }
    )
  }
}
