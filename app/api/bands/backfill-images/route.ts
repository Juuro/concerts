import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getArtistImageUrl } from "@/utils/musicbrainz"

export const maxDuration = 300 // 5 minutes (Vercel Pro/Enterprise limit)

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const overwrite = searchParams.get("overwrite") === "true"
  const dryRun = searchParams.get("dryRun") === "true"

  const whereClause = overwrite
    ? {}
    : { OR: [{ imageUrl: null }, { imageUrl: "" }] }

  const bands = await prisma.band.findMany({
    where: whereClause,
    select: { id: true, name: true, slug: true, imageUrl: true },
    orderBy: { name: "asc" },
  })

  const results: Array<{
    name: string
    status: "updated" | "skipped" | "failed"
    imageUrl?: string
    error?: string
  }> = []

  for (const band of bands) {
    try {
      const imageUrl = await getArtistImageUrl(band.name)

      if (imageUrl) {
        if (!dryRun) {
          await prisma.band.update({
            where: { id: band.id },
            data: { imageUrl },
          })
        }
        results.push({ name: band.name, status: "updated", imageUrl })
      } else {
        results.push({ name: band.name, status: "skipped" })
      }
    } catch (error) {
      results.push({
        name: band.name,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const summary = {
    total: bands.length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    dryRun,
    overwrite,
  }

  return NextResponse.json({ summary, results })
}
