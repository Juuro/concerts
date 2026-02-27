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
    const [festivals, total] = await Promise.all([
      prisma.festival.findMany({
        where: {
          concerts: { none: {} },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          url: true,
          createdAt: true,
          createdBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.festival.count({
        where: {
          concerts: { none: {} },
        },
      }),
    ])

    return NextResponse.json({
      festivals: festivals.map((festival) => ({
        id: festival.id,
        name: festival.name,
        slug: festival.slug,
        url: festival.url,
        createdAt: festival.createdAt,
        createdBy: festival.createdBy?.name || festival.createdBy?.email || null,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching orphaned festivals:", error)
    return NextResponse.json(
      { error: "Failed to fetch orphaned festivals" },
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

  try {
    const body = await request.json().catch(() => ({}))
    const { festivalIds } = body

    // If specific IDs provided, delete those; otherwise delete all orphaned
    let toDelete: { id: string; name: string }[]

    if (Array.isArray(festivalIds) && festivalIds.length > 0) {
      // Delete specific festivals (verify they're orphaned first)
      toDelete = await prisma.festival.findMany({
        where: {
          id: { in: festivalIds },
          concerts: { none: {} },
        },
        select: { id: true, name: true },
      })
    } else {
      // Delete all orphaned festivals
      toDelete = await prisma.festival.findMany({
        where: {
          concerts: { none: {} },
        },
        select: { id: true, name: true },
      })
    }

    if (toDelete.length === 0) {
      return NextResponse.json({
        deleted: 0,
        message: "No orphaned festivals to delete",
      })
    }

    // Delete in transaction with activity logging
    await prisma.$transaction(async (tx) => {
      await tx.festival.deleteMany({
        where: { id: { in: toDelete.map((f) => f.id) } },
      })

      await tx.adminActivity.create({
        data: {
          userId: session.user.id,
          action: "festival_bulk_delete",
          targetType: "festival",
          targetId: toDelete.map((f) => f.id).join(","),
          details: {
            count: toDelete.length,
            festivals: toDelete.map((f) => f.name),
          },
        },
      })
    })

    return NextResponse.json({
      deleted: toDelete.length,
      festivals: toDelete,
    })
  } catch (error) {
    console.error("Error deleting orphaned festivals:", error)
    return NextResponse.json(
      { error: "Failed to delete orphaned festivals" },
      { status: 500 }
    )
  }
}
