import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getSession(await headers())

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
    const [bands, total] = await Promise.all([
      prisma.band.findMany({
        where: {
          lastfmUrl: null,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          createdAt: true,
          _count: {
            select: { concerts: true },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.band.count({
        where: {
          lastfmUrl: null,
        },
      }),
    ])

    return NextResponse.json({
      bands: bands.map((band) => ({
        id: band.id,
        name: band.name,
        slug: band.slug,
        imageUrl: band.imageUrl,
        createdAt: band.createdAt,
        concertCount: band._count.concerts,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error fetching bands without Last.fm:", error)
    return NextResponse.json(
      { error: "Failed to fetch bands" },
      { status: 500 }
    )
  }
}
