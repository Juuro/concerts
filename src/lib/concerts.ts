import { prisma } from "./prisma"
import { unstable_cache } from "next/cache"
import type {
  Concert as PrismaConcert,
  Band as PrismaBand,
  Festival as PrismaFestival,
  ConcertBand,
} from "@/generated/prisma/client"
import { cityToSlug } from "@/utils/helpers"
import { getGeocodingData } from "@/utils/data"
import type { GeocodingData } from "@/types/geocoding"

// Types matching the existing app structure
export interface TransformedBand {
  id: string
  name: string
  slug: string
  url: string
  imageUrl?: string | null
  lastfm?: {
    url?: string | null
    genres?: string[]
    bio?: string | null
  } | null
}

export interface TransformedConcert {
  id: string
  userId: string
  date: string
  city: {
    lat: number
    lon: number
  }
  venue?: string | null
  bands: TransformedBand[]
  isFestival: boolean
  festival: {
    fields: {
      name: string
      url?: string | null
    }
  } | null
  fields: {
    geocoderAddressFields: GeocodingData
  }
}

type ConcertWithRelations = PrismaConcert & {
  bands: (ConcertBand & { band: PrismaBand })[]
  festival: PrismaFestival | null
}

async function transformConcert(concert: ConcertWithRelations): Promise<TransformedConcert> {
  // Use reverse geocoding to get real city name from coordinates
  const geocodingData = await getGeocodingData(concert.latitude, concert.longitude)

  return {
    id: concert.id,
    userId: concert.userId,
    date: concert.date.toISOString(),
    city: {
      lat: concert.latitude,
      lon: concert.longitude,
    },
    venue: concert.venue,
    bands: concert.bands
      .sort(
        (
          a: ConcertBand & { band: PrismaBand },
          b: ConcertBand & { band: PrismaBand }
        ) => a.sortOrder - b.sortOrder
      )
      .map((cb: ConcertBand & { band: PrismaBand }) => ({
        id: cb.band.id,
        name: cb.band.name,
        slug: cb.band.slug,
        url: `/band/${cb.band.slug}/`,
        imageUrl: cb.band.imageUrl,
        lastfm: cb.band.lastfmUrl
          ? {
              url: cb.band.lastfmUrl,
              genres: cb.band.genres,
              bio: cb.band.bio,
            }
          : null,
      })),
    isFestival: concert.isFestival,
    festival: concert.festival
      ? {
          fields: {
            name: concert.festival.name,
            url: concert.festival.url,
          },
        }
      : null,
    fields: {
      geocoderAddressFields: geocodingData,
    },
  }
}

// Get all concerts for a user
export async function getUserConcerts(
  userId: string
): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    where: { userId },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  })

  return Promise.all(concerts.map(transformConcert))
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

  return Promise.all(concerts.map(transformConcert))
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

  return Promise.all(concerts.map(transformConcert))
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

  return Promise.all(concerts.map(transformConcert))
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

  return Promise.all(concerts.map(transformConcert))
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

// Concert CRUD operations

export interface CreateConcertInput {
  userId: string
  date: Date
  latitude: number
  longitude: number
  venue: string
  isFestival?: boolean
  festivalId?: string
  bandIds: { bandId: string; isHeadliner?: boolean }[]
}

export async function createConcert(
  input: CreateConcertInput
): Promise<TransformedConcert> {
  const geocodingData = await getGeocodingData(input.latitude, input.longitude)
  const normalizedCity =
    geocodingData?._normalized_city && !geocodingData._is_coordinates
      ? geocodingData._normalized_city
      : null

  const concert = await prisma.concert.create({
    data: {
      userId: input.userId,
      date: input.date,
      latitude: input.latitude,
      longitude: input.longitude,
      venue: input.venue,
      normalizedCity,
      isFestival: input.isFestival || false,
      festivalId: input.festivalId,
      bands: {
        create: input.bandIds.map((b, index) => ({
          bandId: b.bandId,
          isHeadliner: b.isHeadliner || false,
          sortOrder: index,
        })),
      },
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
  })

  return await transformConcert(concert)
}

export interface UpdateConcertInput {
  date?: Date
  latitude?: number
  longitude?: number
  venue?: string
  isFestival?: boolean
  festivalId?: string | null
  bandIds?: { bandId: string; isHeadliner?: boolean }[]
}

export async function updateConcert(
  id: string,
  userId: string,
  input: UpdateConcertInput
): Promise<TransformedConcert | null> {
  // Verify ownership
  const existing = await prisma.concert.findFirst({
    where: { id, userId },
    select: { id: true, latitude: true, longitude: true },
  })

  if (!existing) {
    return null
  }

  // If updating bands, delete existing and create new
  if (input.bandIds) {
    await prisma.concertBand.deleteMany({
      where: { concertId: id },
    })
  }

  let normalizedCity: string | null | undefined = undefined
  if (input.latitude !== undefined && input.longitude !== undefined) {
    const geocodingData = await getGeocodingData(
      input.latitude ?? existing.latitude,
      input.longitude ?? existing.longitude
    )
    normalizedCity =
      geocodingData?._normalized_city && !geocodingData._is_coordinates
        ? geocodingData._normalized_city
        : null
  }

  const concert = await prisma.concert.update({
    where: { id },
    data: {
      date: input.date,
      latitude: input.latitude,
      longitude: input.longitude,
      venue: input.venue,
      normalizedCity,
      isFestival: input.isFestival,
      festivalId: input.festivalId,
      ...(input.bandIds && {
        bands: {
          create: input.bandIds.map((b, index) => ({
            bandId: b.bandId,
            isHeadliner: b.isHeadliner || false,
            sortOrder: index,
          })),
        },
      }),
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
  })

  return await transformConcert(concert)
}

export async function deleteConcert(
  id: string,
  userId: string
): Promise<boolean> {
  const existing = await prisma.concert.findFirst({
    where: { id, userId },
  })

  if (!existing) {
    return false
  }

  await prisma.concert.delete({
    where: { id },
  })

  return true
}

export async function getConcertById(
  id: string
): Promise<TransformedConcert | null> {
  const concert = await prisma.concert.findUnique({
    where: { id },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
  })

  if (!concert) return null
  return await transformConcert(concert)
}

// ============================================
// Pagination Types and Functions
// ============================================

export interface ConcertFilters {
  userId?: string // Filter by specific user
  bandSlug?: string // Filter by specific band
  year?: number // Filter by year
  city?: string // Filter by normalizedCity
  isPublic?: boolean // Only show public user concerts
}

export interface PaginatedConcerts {
  items: TransformedConcert[]
  nextCursor: string | null
  prevCursor: string | null
  hasMore: boolean
  hasPrevious: boolean
}

export async function getConcertsPaginated(
  cursor?: string,
  limit = 20,
  direction: "forward" | "backward" = "forward",
  filters?: ConcertFilters
): Promise<PaginatedConcerts> {
  const take = direction === "forward" ? limit + 1 : -(limit + 1)

  // Build where clause based on filters
  const where: any = {}

  if (filters?.userId) {
    where.userId = filters.userId
  }

  if (filters?.bandSlug) {
    where.bands = {
      some: {
        band: { slug: filters.bandSlug },
      },
    }
  }

  if (filters?.year) {
    const yearStart = new Date(filters.year, 0, 1)
    const yearEnd = new Date(filters.year, 11, 31, 23, 59, 59, 999)
    where.date = {
      gte: yearStart,
      lte: yearEnd,
    }
  }

  if (filters?.city) {
    where.normalizedCity = filters.city
  }

  if (filters?.isPublic !== undefined) {
    where.user = {
      isPublic: filters.isPublic,
    }
  }

  const concerts = await prisma.concert.findMany({
    take,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    where,
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
      ...(filters?.isPublic !== undefined && {
        user: { select: { isPublic: true } },
      }),
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  })

  // For backward direction, reverse to maintain consistent order
  if (direction === "backward") {
    concerts.reverse()
  }

  const hasExtra = concerts.length > limit
  const items = hasExtra
    ? direction === "forward"
      ? concerts.slice(0, -1)
      : concerts.slice(1)
    : concerts

  return {
    items: await Promise.all(items.map(transformConcert)),
    nextCursor:
      direction === "forward" && hasExtra
        ? items[items.length - 1].id
        : direction === "backward"
          ? (items[items.length - 1]?.id ?? null)
          : null,
    prevCursor:
      direction === "backward" && hasExtra
        ? items[0].id
        : direction === "forward" && cursor
          ? (items[0]?.id ?? null)
          : null,
    hasMore: direction === "forward" ? hasExtra : true,
    hasPrevious: direction === "backward" ? hasExtra : Boolean(cursor),
  }
}

// ============================================
// Concert Counts (lightweight)
// ============================================

export interface ConcertCounts {
  past: number
  future: number
}

export async function getConcertCounts(): Promise<ConcertCounts> {
  const now = new Date()
  const [past, future] = await Promise.all([
    prisma.concert.count({ where: { date: { lt: now } } }),
    prisma.concert.count({ where: { date: { gte: now } } }),
  ])
  return { past, future }
}

// ============================================
// Statistics (server-side with caching)
// ============================================

export interface ConcertStatistics {
  yearCounts: Array<[string, number, string]>
  cityCounts: Array<[string, number, string]>
  mostSeenBands: Array<[string, number, string]>
  maxYearCount: number
  maxCityCount: number
  maxBandCount: number
  totalPast: number
  totalFuture: number
}

async function computeConcertStatistics(): Promise<ConcertStatistics> {
  const now = new Date()

  // Use Prisma aggregations for efficient queries
  const [yearStats, cityStats, bandStats, pastCount, futureCount] =
    await Promise.all([
      // Year counts - get all past concerts grouped by year
      prisma.concert
        .groupBy({
          by: ["date"],
          where: { date: { lt: now } },
          _count: true,
        })
        .then((results) => {
          const yearMap = new Map<string, number>()
          for (const r of results) {
            const year = r.date.getFullYear().toString()
            yearMap.set(year, (yearMap.get(year) || 0) + r._count)
          }
          return Array.from(yearMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(
              ([year, count]) => [year, count, year] as [string, number, string]
            )
        }),

      // City counts (from normalizedCity column)
      prisma.concert
        .groupBy({
          by: ["normalizedCity"],
          where: { date: { lt: now }, normalizedCity: { not: null } },
          _count: true,
          orderBy: { _count: { normalizedCity: "desc" } },
          take: 5,
        })
        .then((results) =>
          results.map(
            (r) =>
              [r.normalizedCity!, r._count, cityToSlug(r.normalizedCity!)] as [
                string,
                number,
                string,
              ]
          )
        ),

      // Most seen bands - need to join through ConcertBand
      prisma.concertBand
        .groupBy({
          by: ["bandId"],
          _count: true,
          orderBy: { _count: { bandId: "desc" } },
          take: 10, // Get more initially to filter by past concerts
        })
        .then(async (results) => {
          // Get band details and filter by past concerts
          const bandIds = results.map((r) => r.bandId)
          const bands = await prisma.band.findMany({
            where: { id: { in: bandIds } },
            select: { id: true, name: true, slug: true },
          })

          // Get counts only for past concerts
          const bandCounts = await Promise.all(
            bandIds.map(async (bandId) => {
              const count = await prisma.concertBand.count({
                where: {
                  bandId,
                  concert: { date: { lt: now } },
                },
              })
              const band = bands.find((b) => b.id === bandId)
              return band ? { ...band, count } : null
            })
          )

          return bandCounts
            .filter(
              (b): b is NonNullable<typeof b> => b !== null && b.count > 0
            )
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((b) => [b.name, b.count, b.slug] as [string, number, string])
        }),

      // Past/future counts
      prisma.concert.count({ where: { date: { lt: now } } }),
      prisma.concert.count({ where: { date: { gte: now } } }),
    ])

  return {
    yearCounts: yearStats,
    cityCounts: cityStats,
    mostSeenBands: bandStats,
    maxYearCount: yearStats[0]?.[1] ?? 0,
    maxCityCount: cityStats[0]?.[1] ?? 0,
    maxBandCount: bandStats[0]?.[1] ?? 0,
    totalPast: pastCount,
    totalFuture: futureCount,
  }
}

// Cached version with 1-hour revalidation
export const getConcertStatistics = unstable_cache(
  computeConcertStatistics,
  ["concert-statistics"],
  { revalidate: 3600, tags: ["concert-statistics"] }
)

// ============================================
// Per-user statistics
// ============================================

async function computeUserConcertStatistics(
  userId: string
): Promise<ConcertStatistics> {
  const now = new Date()

  const [yearStats, cityStats, bandStats, pastCount, futureCount] =
    await Promise.all([
      prisma.concert
        .groupBy({
          by: ["date"],
          where: { userId, date: { lt: now } },
          _count: true,
        })
        .then((results) => {
          const yearMap = new Map<string, number>()
          for (const r of results) {
            const year = r.date.getFullYear().toString()
            yearMap.set(year, (yearMap.get(year) || 0) + r._count)
          }
          return Array.from(yearMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(
              ([year, count]) => [year, count, year] as [string, number, string]
            )
        }),

      prisma.concert
        .groupBy({
          by: ["normalizedCity"],
          where: { userId, date: { lt: now }, normalizedCity: { not: null } },
          _count: true,
          orderBy: { _count: { normalizedCity: "desc" } },
          take: 5,
        })
        .then((results) =>
          results.map(
            (r) =>
              [r.normalizedCity!, r._count, cityToSlug(r.normalizedCity!)] as [
                string,
                number,
                string,
              ]
          )
        ),

      prisma.concertBand
        .groupBy({
          by: ["bandId"],
          where: { concert: { userId } },
          _count: true,
          orderBy: { _count: { bandId: "desc" } },
          take: 10,
        })
        .then(async (results) => {
          const bandIds = results.map((r) => r.bandId)
          const bands = await prisma.band.findMany({
            where: { id: { in: bandIds } },
            select: { id: true, name: true, slug: true },
          })

          const bandCounts = await Promise.all(
            bandIds.map(async (bandId) => {
              const count = await prisma.concertBand.count({
                where: {
                  bandId,
                  concert: { userId, date: { lt: now } },
                },
              })
              const band = bands.find((b) => b.id === bandId)
              return band ? { ...band, count } : null
            })
          )

          return bandCounts
            .filter(
              (b): b is NonNullable<typeof b> => b !== null && b.count > 0
            )
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((b) => [b.name, b.count, b.slug] as [string, number, string])
        }),

      prisma.concert.count({ where: { userId, date: { lt: now } } }),
      prisma.concert.count({ where: { userId, date: { gte: now } } }),
    ])

  return {
    yearCounts: yearStats,
    cityCounts: cityStats,
    mostSeenBands: bandStats,
    maxYearCount: yearStats[0]?.[1] ?? 0,
    maxCityCount: cityStats[0]?.[1] ?? 0,
    maxBandCount: bandStats[0]?.[1] ?? 0,
    totalPast: pastCount,
    totalFuture: futureCount,
  }
}

export const getUserConcertStatistics = unstable_cache(
  async (userId: string) => computeUserConcertStatistics(userId),
  ["user-concert-statistics"],
  { revalidate: 3600, tags: ["user-concert-statistics"] }
)

export async function getUserConcertCounts(
  userId: string
): Promise<ConcertCounts> {
  const now = new Date()
  const [past, future] = await Promise.all([
    prisma.concert.count({ where: { userId, date: { lt: now } } }),
    prisma.concert.count({ where: { userId, date: { gte: now } } }),
  ])
  return { past, future }
}

export async function getGlobalAppStats() {
  const now = new Date()
  const [concertCount, bandCount, userCount] = await Promise.all([
    prisma.concert.count({ where: { date: { lt: now } } }),
    prisma.band.count(),
    prisma.user.count({ where: { isPublic: true } }),
  ])
  return { concertCount, bandCount, userCount }
}
