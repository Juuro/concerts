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
          imageUrl: null,
          imageEnrichedAt: { not: null },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          imageEnrichedAt: true,
          _count: {
            select: { concerts: true },
          },
        },
        orderBy: { imageEnrichedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.band.count({
        where: {
          imageUrl: null,
          imageEnrichedAt: { not: null },
        },
      }),
    ])

    return NextResponse.json({
      bands: bands.map((band) => ({
        id: band.id,
        name: band.name,
        slug: band.slug,
        imageEnrichedAt: band.imageEnrichedAt,
        concertCount: band._count.concerts,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching bands with failed enrichment:", error)
    return NextResponse.json(
      { error: "Failed to fetch bands" },
      { status: 500 }
    )
  }
}
