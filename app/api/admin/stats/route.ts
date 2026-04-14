import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

export interface AdminStats {
  userCount: number
  concertCount: number
  bandCount: number
  festivalCount: number
  concertsToday: number
  concertsThisWeek: number
  concertsThisMonth: number
  concertsThisYear: number
  bandsWithoutImages: number
  bandsEnrichmentFailed: number
  bandsWithoutLastfm: number
  orphanedBands: number
  orphanedFestivals: number
  potentialDuplicateBands: number
  concertsWithoutCity: number
  bannedUsers: number
}

function getStartOfDay(date: Date): Date {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function getStartOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getUTCDay()
  const diff = result.getUTCDate() - day + (day === 0 ? -6 : 1) // Monday as start
  result.setUTCDate(diff)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function getStartOfMonth(date: Date): Date {
  const result = new Date(date)
  result.setUTCDate(1)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function getStartOfYear(date: Date): Date {
  const result = new Date(date)
  result.setUTCMonth(0, 1)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

export async function GET() {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const now = new Date()
    const startOfDay = getStartOfDay(now)
    const startOfWeek = getStartOfWeek(now)
    const startOfMonth = getStartOfMonth(now)
    const startOfYear = getStartOfYear(now)

    const [
      userCount,
      concertCount,
      bandCount,
      festivalCount,
      concertsToday,
      concertsThisWeek,
      concertsThisMonth,
      concertsThisYear,
      bandsWithoutImages,
      bandsEnrichmentFailed,
      bandsWithoutLastfm,
      orphanedBands,
      orphanedFestivals,
      concertsWithoutCity,
      bannedUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.concert.count(),
      prisma.band.count(),
      prisma.festival.count(),
      prisma.concert.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.concert.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.concert.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.concert.count({ where: { createdAt: { gte: startOfYear } } }),
      prisma.band.count({
        where: { imageUrl: null, imageEnrichedAt: null },
      }),
      prisma.band.count({
        where: { imageUrl: null, imageEnrichedAt: { not: null } },
      }),
      prisma.band.count({
        where: { lastfmUrl: null },
      }),
      prisma.band.count({
        where: { concerts: { none: {} } },
      }),
      prisma.festival.count({
        where: { concerts: { none: {} } },
      }),
      prisma.concert.count({
        where: {
          normalizedCity: null,
        },
      }),
      prisma.user.count({ where: { banned: true } }),
    ])

    // Potential duplicates: count bands that have similar names
    // This is a simplified check - we'll do proper detection in the duplicates endpoint
    const potentialDuplicateBands = 0 // Computed in dedicated endpoint

    const stats: AdminStats = {
      userCount,
      concertCount,
      bandCount,
      festivalCount,
      concertsToday,
      concertsThisWeek,
      concertsThisMonth,
      concertsThisYear,
      bandsWithoutImages,
      bandsEnrichmentFailed,
      bandsWithoutLastfm,
      orphanedBands,
      orphanedFestivals,
      potentialDuplicateBands,
      concertsWithoutCity,
      bannedUsers,
    }

    return NextResponse.json(stats)
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error fetching admin stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch admin statistics" },
      { status: 500 }
    )
  }
}
