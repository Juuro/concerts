import { prisma } from "./prisma"
import { unstable_cache } from "next/cache"
import type {
  Concert as PrismaConcert,
  Band as PrismaBand,
  Festival as PrismaFestival,
  ConcertBand,
  UserConcert,
} from "@/generated/prisma/client"
import { cityToSlug } from "@/utils/helpers"
import { getGeocodingData } from "@/utils/data"
import type { GeocodingData } from "@/types/geocoding"

// Coordinate tolerance for matching concerts (~100m)
const COORD_TOLERANCE = 0.001

/**
 * Returns today's date at UTC midnight (00:00:00.000Z).
 * Used for date comparisons to ensure concerts on "today" are treated as future, not past.
 * Uses UTC to match how dates are stored in the database.
 */
export function getStartOfToday(): Date {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return now
}

// Types matching the existing app structure
export interface TransformedBand {
  id: string
  name: string
  slug: string
  url: string
  imageUrl?: string | null
  websiteUrl?: string | null
  lastfm?: {
    url?: string | null
    genres?: string[]
    bio?: string | null
  } | null
}

export interface TransformedConcert {
  id: string
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
  // User-specific attendance data (included when filtering by user)
  attendance?: {
    id: string
    userId: string
    cost?: string | null
    notes?: string | null
  }
  // For social features
  attendeeCount?: number
  // DEPRECATED: For backward compatibility during transition
  userId?: string
  cost?: string | null
}

type ConcertWithRelations = PrismaConcert & {
  bands: (ConcertBand & { band: PrismaBand })[]
  festival: PrismaFestival | null
  attendees?: UserConcert[]
  _count?: { attendees: number }
}

// Type for concert with a specific user's attendance
type ConcertWithAttendance = ConcertWithRelations & {
  userAttendance?: UserConcert | null
}

async function transformConcert(
  concert: ConcertWithAttendance,
  userAttendance?: UserConcert | null
): Promise<TransformedConcert> {
  // Use reverse geocoding to get real city name from coordinates
  const geocodingData = await getGeocodingData(concert.latitude, concert.longitude)

  // Get attendance from parameter or from concert object
  const attendance = userAttendance ?? concert.userAttendance

  const transformed: TransformedConcert = {
    id: concert.id,
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
        websiteUrl: cb.band.websiteUrl,
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

  // Add attendance data if available
  if (attendance) {
    transformed.attendance = {
      id: attendance.id,
      userId: attendance.userId,
      cost: attendance.cost ? attendance.cost.toString() : null,
      notes: attendance.notes,
    }
    // Backward compatibility: populate deprecated fields
    transformed.userId = attendance.userId
    transformed.cost = attendance.cost ? attendance.cost.toString() : null
  }

  // Add attendee count if available
  if (concert._count?.attendees !== undefined) {
    transformed.attendeeCount = concert._count.attendees
  }

  return transformed
}

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

  return Promise.all(
    userConcerts.map((uc) => transformConcert(uc.concert, uc))
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

  return Promise.all(concerts.map((c) => transformConcert(c)))
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

  return Promise.all(concerts.map((c) => transformConcert(c)))
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

  return Promise.all(concerts.map((c) => transformConcert(c)))
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

  return Promise.all(concerts.map((c) => transformConcert(c)))
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

// ============================================
// Concert Matching (for shared concerts)
// ============================================

/**
 * Find an existing concert matching the given criteria.
 * A match requires: same date, location within tolerance, at least one overlapping band.
 */
export async function findMatchingConcert(
  date: Date,
  latitude: number,
  longitude: number,
  bandIds: string[],
  excludeId?: string
): Promise<PrismaConcert | null> {
  // Normalize date to start of day for comparison
  const dateStart = new Date(date)
  dateStart.setUTCHours(0, 0, 0, 0)
  const dateEnd = new Date(date)
  dateEnd.setUTCHours(23, 59, 59, 999)

  const candidates = await prisma.concert.findMany({
    where: {
      date: { gte: dateStart, lte: dateEnd },
      latitude: { gte: latitude - COORD_TOLERANCE, lte: latitude + COORD_TOLERANCE },
      longitude: { gte: longitude - COORD_TOLERANCE, lte: longitude + COORD_TOLERANCE },
      ...(excludeId && { id: { not: excludeId } }),
    },
    include: { bands: { select: { bandId: true } } },
  })

  // Find a candidate with at least one overlapping band
  const bandIdSet = new Set(bandIds)
  return (
    candidates.find((c) => c.bands.some((cb) => bandIdSet.has(cb.bandId))) ??
    null
  )
}

// ============================================
// Concert CRUD operations
// ============================================

export interface CreateConcertInput {
  userId: string
  date: Date
  latitude: number
  longitude: number
  venue: string
  isFestival?: boolean
  festivalId?: string
  cost?: number
  bandIds: { bandId: string; isHeadliner?: boolean }[]
}

export async function createConcert(
  input: CreateConcertInput
): Promise<TransformedConcert> {
  const bandIds = input.bandIds.map((b) => b.bandId)

  // Try to find an existing matching concert
  const existingConcert = await findMatchingConcert(
    input.date,
    input.latitude,
    input.longitude,
    bandIds
  )

  let concert: ConcertWithRelations
  let userConcert: UserConcert

  if (existingConcert) {
    // Link user to existing concert
    userConcert = await prisma.userConcert.create({
      data: {
        userId: input.userId,
        concertId: existingConcert.id,
        cost: input.cost !== undefined ? input.cost : undefined,
      },
    })

    // Fetch the full concert with relations
    concert = (await prisma.concert.findUnique({
      where: { id: existingConcert.id },
      include: {
        bands: {
          include: { band: true },
          orderBy: { sortOrder: "asc" },
        },
        festival: true,
        _count: { select: { attendees: true } },
      },
    }))!
  } else {
    // Create new concert and link user
    const geocodingData = await getGeocodingData(input.latitude, input.longitude)
    const normalizedCity =
      geocodingData?._normalized_city && !geocodingData._is_coordinates
        ? geocodingData._normalized_city
        : null

    concert = await prisma.concert.create({
      data: {
        date: input.date,
        latitude: input.latitude,
        longitude: input.longitude,
        venue: input.venue,
        normalizedCity,
        isFestival: input.isFestival || false,
        festivalId: input.festivalId,
        createdById: input.userId,
        bands: {
          create: input.bandIds.map((b, index) => ({
            bandId: b.bandId,
            isHeadliner: b.isHeadliner || false,
            sortOrder: index,
          })),
        },
        attendees: {
          create: {
            userId: input.userId,
            cost: input.cost !== undefined ? input.cost : undefined,
          },
        },
      },
      include: {
        bands: {
          include: { band: true },
          orderBy: { sortOrder: "asc" },
        },
        festival: true,
        attendees: { where: { userId: input.userId } },
        _count: { select: { attendees: true } },
      },
    })

    userConcert = concert.attendees![0]
  }

  return await transformConcert(concert, userConcert)
}

export interface UpdateConcertInput {
  // Shared concert data (any attendee can update)
  date?: Date
  latitude?: number
  longitude?: number
  venue?: string
  isFestival?: boolean
  festivalId?: string | null
  bandIds?: { bandId: string; isHeadliner?: boolean }[]
  // User-specific attendance data
  cost?: number | null
  notes?: string | null
}

export async function updateConcert(
  id: string,
  userId: string,
  input: UpdateConcertInput
): Promise<TransformedConcert | null> {
  // Verify user has attendance (is linked to this concert)
  const attendance = await prisma.userConcert.findUnique({
    where: { userId_concertId: { userId, concertId: id } },
  })

  if (!attendance) {
    return null
  }

  const existing = await prisma.concert.findUnique({
    where: { id },
    select: { id: true, latitude: true, longitude: true },
  })

  if (!existing) {
    return null
  }

  // Update user-specific attendance data
  if (input.cost !== undefined || input.notes !== undefined) {
    await prisma.userConcert.update({
      where: { id: attendance.id },
      data: {
        ...(input.cost !== undefined && { cost: input.cost }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    })
  }

  // Update shared concert data (any attendee can edit)
  const hasSharedUpdates =
    input.date !== undefined ||
    input.latitude !== undefined ||
    input.longitude !== undefined ||
    input.venue !== undefined ||
    input.isFestival !== undefined ||
    input.festivalId !== undefined ||
    input.bandIds !== undefined

  if (hasSharedUpdates) {
    // If updating bands, delete existing and create new
    if (input.bandIds) {
      await prisma.concertBand.deleteMany({
        where: { concertId: id },
      })
    }

    let normalizedCity: string | null | undefined = undefined
    if (input.latitude !== undefined || input.longitude !== undefined) {
      const geocodingData = await getGeocodingData(
        input.latitude ?? existing.latitude,
        input.longitude ?? existing.longitude
      )
      normalizedCity =
        geocodingData?._normalized_city && !geocodingData._is_coordinates
          ? geocodingData._normalized_city
          : null
    }

    await prisma.concert.update({
      where: { id },
      data: {
        date: input.date,
        latitude: input.latitude,
        longitude: input.longitude,
        venue: input.venue,
        normalizedCity,
        isFestival: input.isFestival,
        festivalId: input.festivalId,
        updatedById: userId,
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
    })

    // Check if the updated concert now matches a different existing concert
    const updatedConcert = await prisma.concert.findUnique({
      where: { id },
      include: { bands: { select: { bandId: true } } },
    })

    if (updatedConcert) {
      const bandIds = updatedConcert.bands.map((b) => b.bandId)

      if (bandIds.length > 0) {
        const matchingConcert = await findMatchingConcert(
          updatedConcert.date,
          updatedConcert.latitude,
          updatedConcert.longitude,
          bandIds,
          id // Exclude the concert being edited
        )

        // If we found a matching concert, migrate the user
        if (matchingConcert) {
          // Re-fetch attendance to get current cost/notes values
          const currentAttendance = await prisma.userConcert.findUnique({
            where: { userId_concertId: { userId, concertId: id } },
          })

          // Check if user already attends the matching concert
          const existingAttendance = await prisma.userConcert.findUnique({
            where: {
              userId_concertId: { userId, concertId: matchingConcert.id },
            },
          })

          if (!existingAttendance && currentAttendance) {
            // Migrate attendance to matching concert (preserve cost/notes)
            await prisma.userConcert.create({
              data: {
                userId,
                concertId: matchingConcert.id,
                cost: currentAttendance.cost,
                notes: currentAttendance.notes,
              },
            })
          }

          // Remove old attendance link
          await prisma.userConcert.delete({
            where: { id: attendance.id },
          })

          // Delete orphaned concert if no other attendees
          const remainingAttendees = await prisma.userConcert.count({
            where: { concertId: id },
          })

          if (remainingAttendees === 0) {
            await prisma.concert.delete({ where: { id } })
          }

          // Return the matching concert instead
          const finalConcert = await prisma.concert.findUnique({
            where: { id: matchingConcert.id },
            include: {
              bands: {
                include: { band: true },
                orderBy: { sortOrder: "asc" },
              },
              festival: true,
              attendees: { where: { userId } },
              _count: { select: { attendees: true } },
            },
          })

          if (finalConcert) {
            return await transformConcert(finalConcert, finalConcert.attendees[0])
          }
        }
      }
    }
  }

  // Fetch updated concert with relations
  const concert = await prisma.concert.findUnique({
    where: { id },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
      attendees: { where: { userId } },
      _count: { select: { attendees: true } },
    },
  })

  if (!concert) return null

  return await transformConcert(concert, concert.attendees[0])
}

export async function deleteConcert(
  id: string,
  userId: string
): Promise<boolean> {
  // Verify user has attendance
  const attendance = await prisma.userConcert.findUnique({
    where: { userId_concertId: { userId, concertId: id } },
  })

  if (!attendance) {
    return false
  }

  // Delete the user's attendance (unlink from concert)
  await prisma.userConcert.delete({
    where: { id: attendance.id },
  })

  // Check if concert is now orphaned (no remaining attendees)
  const remainingAttendees = await prisma.userConcert.count({
    where: { concertId: id },
  })

  if (remainingAttendees === 0) {
    // Delete orphaned concert
    await prisma.concert.delete({
      where: { id },
    })
  }

  return true
}

export async function getConcertById(
  id: string,
  userId?: string
): Promise<TransformedConcert | null> {
  const concert = await prisma.concert.findUnique({
    where: { id },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
      ...(userId && { attendees: { where: { userId } } }),
      _count: { select: { attendees: true } },
    },
  })

  if (!concert) return null

  const attendance = userId ? (concert as any).attendees?.[0] : undefined
  return await transformConcert(concert, attendance)
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

  // When filtering by userId, we query through UserConcert
  if (filters?.userId) {
    return getConcertsPaginatedForUser(cursor, limit, direction, filters)
  }

  // Build where clause for concerts without user filter
  const where: any = {}

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

  // For public filter without userId, filter by concerts that have at least one public attendee
  if (filters?.isPublic !== undefined) {
    where.attendees = {
      some: {
        user: { isPublic: filters.isPublic },
      },
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
      _count: { select: { attendees: true } },
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
    items: await Promise.all(items.map((c) => transformConcert(c))),
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

// Helper for user-filtered pagination (queries via UserConcert)
async function getConcertsPaginatedForUser(
  cursor: string | undefined,
  limit: number,
  direction: "forward" | "backward",
  filters: ConcertFilters
): Promise<PaginatedConcerts> {
  const take = direction === "forward" ? limit + 1 : -(limit + 1)

  // Build where clause for the concert relation
  const concertWhere: any = {}

  if (filters.bandSlug) {
    concertWhere.bands = {
      some: {
        band: { slug: filters.bandSlug },
      },
    }
  }

  if (filters.year) {
    const yearStart = new Date(filters.year, 0, 1)
    const yearEnd = new Date(filters.year, 11, 31, 23, 59, 59, 999)
    concertWhere.date = {
      gte: yearStart,
      lte: yearEnd,
    }
  }

  if (filters.city) {
    concertWhere.normalizedCity = filters.city
  }

  // Build where for UserConcert
  const where: any = {
    userId: filters.userId,
    ...(Object.keys(concertWhere).length > 0 && { concert: concertWhere }),
  }

  // Also filter by public user if requested
  if (filters.isPublic !== undefined) {
    where.user = { isPublic: filters.isPublic }
  }

  // Query UserConcert to get user's attended concerts
  const userConcerts = await prisma.userConcert.findMany({
    take,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    where,
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
    orderBy: [{ concert: { date: "desc" } }, { id: "desc" }],
  })

  // For backward direction, reverse to maintain consistent order
  if (direction === "backward") {
    userConcerts.reverse()
  }

  const hasExtra = userConcerts.length > limit
  const items = hasExtra
    ? direction === "forward"
      ? userConcerts.slice(0, -1)
      : userConcerts.slice(1)
    : userConcerts

  return {
    items: await Promise.all(
      items.map((uc) => transformConcert(uc.concert, uc))
    ),
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
  const now = getStartOfToday()
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
  const now = getStartOfToday()

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
  const now = getStartOfToday()

  // Get user's attended concerts via UserConcert
  const userConcertIds = await prisma.userConcert.findMany({
    where: { userId },
    select: { concertId: true },
  })
  const concertIds = userConcertIds.map((uc) => uc.concertId)

  const [yearStats, cityStats, bandStats, pastCount, futureCount] =
    await Promise.all([
      // Year counts for user's attended concerts
      prisma.concert
        .groupBy({
          by: ["date"],
          where: { id: { in: concertIds }, date: { lt: now } },
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

      // City counts for user's attended concerts
      prisma.concert
        .groupBy({
          by: ["normalizedCity"],
          where: {
            id: { in: concertIds },
            date: { lt: now },
            normalizedCity: { not: null },
          },
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

      // Most seen bands for user's attended concerts
      prisma.concertBand
        .groupBy({
          by: ["bandId"],
          where: { concertId: { in: concertIds } },
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
                  concertId: { in: concertIds },
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

      // Count user's past concerts
      prisma.userConcert.count({
        where: { userId, concert: { date: { lt: now } } },
      }),
      // Count user's future concerts
      prisma.userConcert.count({
        where: { userId, concert: { date: { gte: now } } },
      }),
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
  const now = getStartOfToday()
  const [past, future] = await Promise.all([
    prisma.userConcert.count({
      where: { userId, concert: { date: { lt: now } } },
    }),
    prisma.userConcert.count({
      where: { userId, concert: { date: { gte: now } } },
    }),
  ])
  return { past, future }
}

export async function getGlobalAppStats() {
  const now = getStartOfToday()
  const [concertCount, bandCount, userCount] = await Promise.all([
    prisma.concert.count({ where: { date: { lt: now } } }),
    prisma.band.count(),
    prisma.user.count({ where: { isPublic: true } }),
  ])
  return { concertCount, bandCount, userCount }
}

// ============================================
// User Spending Aggregation
// ============================================

export async function getUserTotalSpent(
  userId: string,
  filters?: { bandSlug?: string; city?: string; year?: number }
): Promise<{ total: number; currency: string }> {
  // Build concert filter conditions
  const concertWhere: any = {}

  if (filters?.bandSlug) {
    concertWhere.bands = { some: { band: { slug: filters.bandSlug } } }
  }
  if (filters?.city) {
    concertWhere.normalizedCity = filters.city
  }
  if (filters?.year) {
    const yearStart = new Date(filters.year, 0, 1)
    const yearEnd = new Date(filters.year, 11, 31, 23, 59, 59, 999)
    concertWhere.date = { gte: yearStart, lte: yearEnd }
  }

  // Query UserConcert for user's costs
  const where: any = {
    userId,
    cost: { not: null },
    ...(Object.keys(concertWhere).length > 0 && { concert: concertWhere }),
  }

  const [result, user] = await Promise.all([
    prisma.userConcert.aggregate({
      where,
      _sum: { cost: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    }),
  ])

  return {
    total: result._sum.cost ? Number(result._sum.cost) : 0,
    currency: user?.currency || "EUR",
  }
}
