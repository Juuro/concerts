import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { enrichBandData } from "@/lib/bands"
import { after } from "next/server"

const MAX_BANDS_PER_REQUEST = 10
const DELAY_BETWEEN_BANDS_MS = 2000

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
    const { bandIds, imageOnly = false } = body

    if (!Array.isArray(bandIds) || bandIds.length === 0) {
      return NextResponse.json(
        { error: "bandIds must be a non-empty array" },
        { status: 400 }
      )
    }

    // Limit the number of bands per request
    const limitedBandIds = bandIds.slice(0, MAX_BANDS_PER_REQUEST)

    // Fetch the bands to ensure they exist and get their names
    const bands = await prisma.band.findMany({
      where: { id: { in: limitedBandIds } },
      select: { id: true, name: true },
    })

    if (bands.length === 0) {
      return NextResponse.json(
        { error: "No valid bands found" },
        { status: 404 }
      )
    }

    // Log the admin activity
    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "band_bulk_enrich",
        targetType: "band",
        targetId: bands.map((b) => b.id).join(","),
        details: {
          bandCount: bands.length,
          bandNames: bands.map((b) => b.name),
          imageOnly,
        },
      },
    })

    // Queue enrichment in background with delays
    after(async () => {
      for (const band of bands) {
        try {
          await enrichBandData(band.id, band.name, { imageOnly })
        } catch (error) {
          console.error(`Failed to enrich band ${band.name}:`, error)
        }
        // Wait before processing next band
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BANDS_MS)
        )
      }
    })

    return NextResponse.json({
      message: "Bulk enrichment queued",
      queued: bands.length,
      skipped: bandIds.length - limitedBandIds.length,
      bands: bands.map((b) => ({ id: b.id, name: b.name })),
    })
  } catch (error) {
    console.error("Error triggering bulk band enrichment:", error)
    return NextResponse.json(
      { error: "Failed to trigger bulk enrichment" },
      { status: 500 }
    )
  }
}
