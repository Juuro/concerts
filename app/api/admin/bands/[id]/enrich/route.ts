import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { enrichBandData } from "@/lib/bands"
import { after } from "next/server"

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
  const body = await request.json().catch(() => ({}))
  const imageOnly = body.imageOnly === true

  try {
    const band = await prisma.band.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!band) {
      return NextResponse.json({ error: "Band not found" }, { status: 404 })
    }

    // Log the admin activity
    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "band_enrich",
        targetType: "band",
        targetId: band.id,
        details: { bandName: band.name, imageOnly },
      },
    })

    // Trigger enrichment in background
    after(async () => {
      await enrichBandData(band.id, band.name, { imageOnly })
    })

    return NextResponse.json({
      message: "Enrichment queued",
      bandId: band.id,
      bandName: band.name,
    })
  } catch (error) {
    console.error("Error triggering band enrichment:", error)
    return NextResponse.json(
      { error: "Failed to trigger enrichment" },
      { status: 500 }
    )
  }
}
