import { prisma } from "../prisma"
import type { Band as PrismaBand, ConcertBand } from "@/generated/prisma/client"
import type { TransformedConcert } from "./types"
import {
  parseSupportingActIds,
  transformConcert,
  transformConcertsBatch,
} from "./transform"

// Get all concerts for a user (via UserConcert junction)
export async function getUserConcerts(
  userId: string
): Promise<TransformedConcert[]> {
  const userConcerts = await prisma.userConcert.findMany({
    where: { userId },
    include: {
      concert: {
        include: {
          bands: {
            include: { band: true },
            orderBy: { sortOrder: "asc" },
          },
          festival: true,
          _count: { select: { attendees: true } },
        },
      },
    },
    orderBy: { concert: { date: "desc" } },
  })

  return transformConcertsBatch(
    userConcerts.map((uc) => ({ concert: uc.concert, attendance: uc }))
  )
}

// Get all concerts (public, for global views)
export async function getAllConcerts(): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  })

  return transformConcertsBatch(concerts.map((c) => ({ concert: c })))
}

// Get concerts by band slug
export async function getConcertsByBand(
  slug: string
): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    where: {
      bands: {
        some: {
          band: { slug },
        },
      },
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  })

  return transformConcertsBatch(concerts.map((c) => ({ concert: c })))
}

// Get concerts by year
export async function getConcertsByYear(
  year: number | string
): Promise<TransformedConcert[]> {
  const yearNum = typeof year === "string" ? parseInt(year, 10) : year
  const startDate = new Date(yearNum, 0, 1)
  const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999)

  const concerts = await prisma.concert.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  })

  return transformConcertsBatch(concerts.map((c) => ({ concert: c })))
}

// Get concerts by city (from normalizedCity column)
export async function getConcertsByCity(
  cityName: string
): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    where: { normalizedCity: cityName },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  })

  return transformConcertsBatch(concerts.map((c) => ({ concert: c })))
}

// Get all unique years
export async function getAllYears(): Promise<string[]> {
  const concerts = await prisma.concert.findMany({
    where: {
      date: { lte: new Date() },
    },
    select: { date: true },
  })

  const years = new Set<string>()
  concerts.forEach((concert) => {
    years.add(concert.date.getFullYear().toString())
  })

  return Array.from(years).sort()
}

// Get all unique cities (from normalizedCity column)
export async function getAllCities(): Promise<string[]> {
  const results = await prisma.concert.findMany({
    where: { normalizedCity: { not: null } },
    select: { normalizedCity: true },
    distinct: ["normalizedCity"],
  })
  return results.map((r) => r.normalizedCity!).sort()
}

export async function getConcertById(
  id: string,
  userId?: string
): Promise<TransformedConcert | null> {
  if (userId) {
    const concert = await prisma.concert.findUnique({
      where: { id },
      include: {
        bands: {
          include: { band: true },
          orderBy: { sortOrder: "asc" },
        },
        festival: true,
        attendees: { where: { userId }, take: 1 },
        _count: { select: { attendees: true } },
      },
    })

    if (!concert) return null

    const attendance = concert.attendees[0]
    return await transformConcert(concert, attendance)
  }

  const concert = await prisma.concert.findUnique({
    where: { id },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
      _count: { select: { attendees: true } },
    },
  })

  if (!concert) return null
  return await transformConcert(concert)
}

/**
 * Returns effective bands for a user's concert (for edit form).
 * Headliner comes from ConcertBand (shared), support acts from UserConcert.supportingActIds (per-user).
 */
export async function getEffectiveBandsForForm(
  concert: { bands: (ConcertBand & { band: PrismaBand })[] },
  attendance: { supportingActIds?: unknown } | null
): Promise<
  { bandId: string; name: string; slug: string; isHeadliner: boolean }[]
> {
  // Headliner always comes from ConcertBand (shared)
  const sortedCore = concert.bands.sort(
    (
      a: ConcertBand & { band: PrismaBand },
      b: ConcertBand & { band: PrismaBand }
    ) => a.sortOrder - b.sortOrder
  )
  const headliner = sortedCore.find((cb) => cb.isHeadliner)

  // Support acts come from UserConcert.supportingActIds (per-user).
  // Legacy fallback: if parsing yields null for an existing attendance record,
  // use non-headliner ConcertBand entries so support acts stay editable pre-migration.
  const parsedSupportingActs = attendance
    ? parseSupportingActIds(attendance.supportingActIds)
    : null
  const legacySupportingActs =
    attendance && parsedSupportingActs == null
      ? sortedCore
          .filter((cb) => !cb.isHeadliner)
          .map((cb) => ({
            bandId: cb.band.id,
            name: cb.band.name,
            slug: cb.band.slug,
            isHeadliner: false,
          }))
      : null
  const supportingActBandIds = parsedSupportingActs?.map((o) => o.bandId) ?? []
  const supportingActBands =
    supportingActBandIds.length > 0
      ? await prisma.band.findMany({
          where: { id: { in: supportingActBandIds } },
        })
      : []
  const bandsById = new Map(supportingActBands.map((b) => [b.id, b]))

  return [
    ...(headliner
      ? [
          {
            bandId: headliner.band.id,
            name: headliner.band.name,
            slug: headliner.band.slug,
            isHeadliner: true,
          },
        ]
      : []),
    ...(legacySupportingActs ??
      (parsedSupportingActs ?? [])
        .map((o) => {
          const b = bandsById.get(o.bandId)
          return b
            ? {
                bandId: b.id,
                name: b.name,
                slug: b.slug,
                isHeadliner: false,
              }
            : null
        })
        .filter(
          (
            x
          ): x is {
            bandId: string
            name: string
            slug: string
            isHeadliner: boolean
          } => x != null
        )),
  ]
}
