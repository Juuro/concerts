import { NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession(await headers())

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [
    bandsWithoutImages,
    bandsEnrichmentFailed,
    totalBands,
    concertsWithoutCity,
    totalConcerts,
    orphanedFestivals,
    totalFestivals,
    bannedUsers,
    totalUsers,
  ] = await Promise.all([
    prisma.band.count({
      where: { imageUrl: null, imageEnrichedAt: null },
    }),
    prisma.band.count({
      where: { imageUrl: null, imageEnrichedAt: { not: null } },
    }),
    prisma.band.count(),
    prisma.concert.count({
      where: { normalizedCity: null },
    }),
    prisma.concert.count(),
    prisma.festival.count({
      where: { concerts: { none: {} } },
    }),
    prisma.festival.count(),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count(),
  ])

  return NextResponse.json({
    bandsWithoutImages,
    bandsEnrichmentFailed,
    totalBands,
    concertsWithoutCity,
    totalConcerts,
    orphanedFestivals,
    totalFestivals,
    bannedUsers,
    totalUsers,
  })
}
