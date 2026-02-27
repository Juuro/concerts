import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
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
          concerts: { none: {} },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          createdAt: true,
          createdBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.band.count({
        where: {
          concerts: { none: {} },
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
        createdBy: band.createdBy?.name || band.createdBy?.email || null,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching orphaned bands:", error)
    return NextResponse.json(
      { error: "Failed to fetch orphaned bands" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"

  try {
    // Find all bands with zero linked concerts
    const orphanedBands = await prisma.band.findMany({
      where: {
        concerts: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdBy: {
          select: { name: true, email: true },
        },
      },
    })

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: orphanedBands.length,
        bands: orphanedBands.map((b) => ({
          name: b.name,
          slug: b.slug,
          createdBy: b.createdBy?.name || b.createdBy?.email || null,
        })),
      })
    }

    // Delete orphaned bands in a transaction
    const deletedCount = await prisma.band.deleteMany({
      where: {
        id: { in: orphanedBands.map((b) => b.id) },
      },
    })

    return NextResponse.json({
      deleted: deletedCount.count,
      bands: orphanedBands.map((b) => ({
        name: b.name,
        slug: b.slug,
        createdBy: b.createdBy?.name || b.createdBy?.email || null,
      })),
    })
  } catch (error) {
    console.error("Error cleaning up orphaned bands:", error)
    return NextResponse.json(
      { error: "Failed to clean up orphaned bands" },
      { status: 500 }
    )
  }
}
