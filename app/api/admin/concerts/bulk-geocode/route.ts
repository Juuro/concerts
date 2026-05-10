import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getGeocodingData } from "@/utils/data"
import { after } from "next/server"

const MAX_CONCERTS_PER_REQUEST = 5
const DELAY_BETWEEN_CONCERTS_MS = 1000

export async function POST(request: NextRequest) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { concertIds } = body

    if (!Array.isArray(concertIds) || concertIds.length === 0) {
      return NextResponse.json(
        { error: "concertIds must be a non-empty array" },
        { status: 400 }
      )
    }

    // Limit the number of concerts per request
    const limitedIds = concertIds.slice(0, MAX_CONCERTS_PER_REQUEST)

    // Fetch the concerts to ensure they exist and get coordinates
    const concerts = await prisma.concert.findMany({
      where: {
        id: { in: limitedIds },
      },
      select: {
        id: true,
        venue: true,
        latitude: true,
        longitude: true,
      },
    })

    if (concerts.length === 0) {
      return NextResponse.json(
        { error: "No valid concerts found" },
        { status: 404 }
      )
    }

    // Log the admin activity
    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "concert_bulk_geocode",
        targetType: "concert",
        targetId: concerts.map((c) => c.id).join(","),
        details: {
          count: concerts.length,
          venues: concerts.map((c) => c.venue),
        },
      },
    })

    // Queue geocoding in background with delays
    after(async () => {
      for (const concert of concerts) {
        try {
          if (concert.latitude === null || concert.longitude === null) continue

          const geocodingData = await getGeocodingData(
            concert.latitude,
            concert.longitude
          )

          const normalizedCity =
            geocodingData?._normalized_city && !geocodingData._is_coordinates
              ? geocodingData._normalized_city
              : null

          await prisma.concert.update({
            where: { id: concert.id },
            data: { normalizedCity },
          })
        } catch (error) {
          console.error(`Failed to geocode concert ${concert.id}:`, error)
        }

        // Wait before processing next concert (rate limiting)
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_CONCERTS_MS)
        )
      }
    })

    return NextResponse.json({
      message: "Bulk geocoding queued",
      queued: concerts.length,
      skipped: concertIds.length - limitedIds.length,
      concerts: concerts.map((c) => ({ id: c.id, venue: c.venue })),
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error triggering bulk geocoding:", error)
    return NextResponse.json(
      { error: "Failed to trigger bulk geocoding" },
      { status: 500 }
    )
  }
}
