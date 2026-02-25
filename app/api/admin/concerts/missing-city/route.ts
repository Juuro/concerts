import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    const [concerts, total] = await Promise.all([
      prisma.concert.findMany({
        where: {
          normalizedCity: null,
        },
        select: {
          id: true,
          venue: true,
          latitude: true,
          longitude: true,
          date: true,
          createdAt: true,
          createdBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.concert.count({
        where: {
          normalizedCity: null,
        },
      }),
    ])

    return NextResponse.json({
      concerts: concerts.map((concert) => ({
        id: concert.id,
        venue: concert.venue,
        latitude: concert.latitude,
        longitude: concert.longitude,
        date: concert.date,
        createdAt: concert.createdAt,
        user: concert.createdBy?.name || concert.createdBy?.email || "Unknown",
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching concerts without city:", error)
    return NextResponse.json(
      { error: "Failed to fetch concerts" },
      { status: 500 }
    )
  }
}
