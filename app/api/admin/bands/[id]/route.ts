import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const force = request.nextUrl.searchParams.get("force") === "true"

  try {
    const band = await prisma.band.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { concerts: true } },
      },
    })

    if (!band) {
      return NextResponse.json({ error: "Band not found" }, { status: 404 })
    }

    if (band._count.concerts > 0 && !force) {
      return NextResponse.json(
        {
          error: "Band has concerts attached",
          concertCount: band._count.concerts,
          hint: "Use force=true to delete anyway",
        },
        { status: 400 }
      )
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete all ConcertBand relations first
      await tx.concertBand.deleteMany({
        where: { bandId: id },
      })

      // Delete the band
      await tx.band.delete({
        where: { id },
      })

      // Log the admin activity
      await tx.adminActivity.create({
        data: {
          userId: session.user.id,
          action: "band_delete",
          targetType: "band",
          targetId: band.id,
          details: {
            bandName: band.name,
            bandSlug: band.slug,
            concertCount: band._count.concerts,
            forced: force && band._count.concerts > 0,
          },
        },
      })
    })

    return NextResponse.json({
      deleted: true,
      band: {
        id: band.id,
        name: band.name,
        slug: band.slug,
      },
    })
  } catch (error) {
    console.error("Error deleting band:", error)
    return NextResponse.json(
      { error: "Failed to delete band" },
      { status: 500 }
    )
  }
}
