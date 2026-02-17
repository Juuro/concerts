import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

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
