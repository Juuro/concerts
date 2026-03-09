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

/** User-specific support act override: bandId + sortOrder. Headliner always comes from core. */
export type BandOverrideItem = { bandId: string; sortOrder: number }

/**
 * Parses bandOverrideIds from UserConcert.
 * - Returns null when field is missing/invalid: use core concert bands.
 * - Returns [] when user explicitly has no support acts: show headliner only.
 * - Returns [...] when user has specific support acts: show headliner + these.
 */
function parseBandOverrideIds(raw: unknown): BandOverrideItem[] | null {
  if (raw == null || !Array.isArray(raw)) return null
  const arr = raw as unknown[]
  const out: BandOverrideItem[] = []
  for (const item of arr) {
    if (item && typeof item === "object" && "bandId" in item && "sortOrder" in item) {
      const o = item as { bandId: unknown; sortOrder: unknown }
      if (typeof o.bandId === "string" && typeof o.sortOrder === "number") {
        out.push({ bandId: o.bandId, sortOrder: o.sortOrder })
      }
    }
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder)
}

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
  isHeadliner?: boolean
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

function bandToTransformed(band: PrismaBand, isHeadliner?: boolean): TransformedBand {
  return {
    id: band.id,
    name: band.name,
    slug: band.slug,
    url: `/band/${band.slug}/`,
    imageUrl: band.imageUrl,
    websiteUrl: band.websiteUrl,
    lastfm: band.lastfmUrl
      ? {
          url: band.lastfmUrl,
          genres: band.genres,
          bio: band.bio,
        }
      : null,
    isHeadliner,
  }
}

async function transformConcert(
  concert: ConcertWithAttendance,
  userAttendance?: UserConcert | null
): Promise<TransformedConcert> {
  // Use reverse geocoding to get real city name from coordinates
  const geocodingData = await getGeocodingData(concert.latitude, concert.longitude)

  // Get attendance from parameter or from concert object
  const attendance = userAttendance ?? concert.userAttendance

  let bands: TransformedBand[]
  const overrideItems = attendance ? parseBandOverrideIds((attendance as { bandOverrideIds?: unknown }).bandOverrideIds) : null
  if (overrideItems !== null) {
    const coreBands = concert.bands.sort(
      (a: ConcertBand & { band: PrismaBand }, b: ConcertBand & { band: PrismaBand }) => a.sortOrder - b.sortOrder
    )
    const headliner = coreBands.find((cb) => cb.isHeadliner)
    const headlinerBand = headliner
      ? bandToTransformed(headliner.band, true)
      : null
    const overrideBandIds = overrideItems.map((o) => o.bandId)
    const bandsById =
      overrideBandIds.length > 0
        ? await prisma.band.findMany({ where: { id: { in: overrideBandIds } } }).then((list) => new Map(list.map((b) => [b.id, b])))
        : new Map<string, PrismaBand>()
    const overrideBands = overrideItems
      .map((o) => bandsById.get(o.bandId))
      .filter((b): b is PrismaBand => b != null)
    bands = [
      ...(headlinerBand ? [headlinerBand] : []),
      ...overrideBands.map((b) => bandToTransformed(b, false)),
    ]
  } else {
    bands = concert.bands
      .sort(
        (
          a: ConcertBand & { band: PrismaBand },
          b: ConcertBand & { band: PrismaBand }
        ) => a.sortOrder - b.sortOrder
      )
      .map((cb: ConcertBand & { band: PrismaBand }) =>
        bandToTransformed(cb.band, cb.isHeadliner)
      )
  }

  const transformed: TransformedConcert = {
    id: concert.id,
    date: concert.date.toISOString(),
    city: {
      lat: concert.latitude,
      lon: concert.longitude,
    },
    venue: concert.venue,
    bands,
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
 * Get the headliner band from a list of concert bands.
 */
function getHeadliner(
  bands: { bandId: string; isHeadliner: boolean }[]
): { bandId: string; isHeadliner: boolean } | undefined {
  return bands.find((b) => b.isHeadliner)
}

/**
 * Find an existing concert matching the given criteria.
 * Requires: same date, location within tolerance, and the given headliner band.
 * Used for create (link to existing) and merge-after-fork.
 */
export async function findMatchingConcert(
  date: Date,
  latitude: number,
  longitude: number,
  headlinerBandId: string,
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
      bands: {
        some: {
          bandId: headlinerBandId,
          isHeadliner: true,
        },
      },
    },
    take: 1,
  })

  return candidates[0] ?? null
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
  const headliner = getHeadliner(
    input.bandIds.map((b) => ({ bandId: b.bandId, isHeadliner: b.isHeadliner ?? false }))
  )
  const headlinerBandId = headliner?.bandId

  let concert: ConcertWithRelations
  let userConcert: UserConcert

  if (headlinerBandId) {
    // Try to find an existing concert with same date, location, and headliner
    const existingConcert = await findMatchingConcert(
      input.date,
      input.latitude,
      input.longitude,
      headlinerBandId
    )

    if (existingConcert) {
      // Fetch full concert to compare support acts
      const existingWithBands = await prisma.concert.findUnique({
        where: { id: existingConcert.id },
        include: {
          bands: { include: { band: true }, orderBy: { sortOrder: "asc" } },
          festival: true,
          _count: { select: { attendees: true } },
        },
      })
      if (!existingWithBands) throw new Error("Concert not found")

      const coreHeadlinerId = getHeadliner(existingWithBands.bands.map((cb) => ({ bandId: cb.bandId, isHeadliner: cb.isHeadliner })))?.bandId
      const coreSupportActIds = existingWithBands.bands
        .filter((cb) => cb.bandId !== coreHeadlinerId)
        .map((cb) => cb.bandId)
      const inputSupportActIds = input.bandIds
        .filter((b) => b.bandId !== headlinerBandId)
        .map((b) => b.bandId)

      const supportActsDiffer =
        coreSupportActIds.length !== inputSupportActIds.length ||
        coreSupportActIds.some((id, i) => id !== inputSupportActIds[i])

      const bandOverrideIds: BandOverrideItem[] | undefined = supportActsDiffer
        ? input.bandIds
            .filter((b) => b.bandId !== headlinerBandId)
            .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))
        : undefined

      userConcert = await prisma.userConcert.create({
        data: {
          userId: input.userId,
          concertId: existingConcert.id,
          cost: input.cost !== undefined ? input.cost : undefined,
          bandOverrideIds: bandOverrideIds ?? undefined,
        },
      })

      concert = existingWithBands
    } else {
      concert = await createNewConcertWithUser(input)
      userConcert = concert.attendees![0]
    }
  } else {
    concert = await createNewConcertWithUser(input)
    userConcert = concert.attendees![0]
  }

  return await transformConcert(concert, userConcert)
}

/** Create a new Concert + UserConcert (no matching). */
async function createNewConcertWithUser(
  input: CreateConcertInput
): Promise<ConcertWithRelations> {
  const geocodingData = await getGeocodingData(input.latitude, input.longitude)
  const normalizedCity =
    geocodingData?._normalized_city && !geocodingData._is_coordinates
      ? geocodingData._normalized_city
      : null

  const concert = await prisma.concert.create({
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

  return concert
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

/**
 * Fork a concert for a user when they edit fork-triggering fields
 * on a multi-attendee concert. This creates a new concert with the
 * edited data and links only the editing user to it, leaving the
 * original concert unchanged for other attendees.
 */
async function forkConcertForUser(
  originalConcert: ConcertWithRelations,
  userId: string,
  input: UpdateConcertInput,
  currentAttendance: { cost: any; notes: string | null }
): Promise<TransformedConcert> {
  // Get geocoding data for the new location
  const latitude = input.latitude ?? originalConcert.latitude
  const longitude = input.longitude ?? originalConcert.longitude
  const geocodingData = await getGeocodingData(latitude, longitude)
  const normalizedCity =
    geocodingData?._normalized_city && !geocodingData._is_coordinates
      ? geocodingData._normalized_city
      : null

  // Prepare band data (use input bands or copy from original)
  const bandsToCreate =
    input.bandIds ??
    originalConcert.bands.map((cb) => ({
      bandId: cb.bandId,
      isHeadliner: cb.isHeadliner,
    }))

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Remove user from original concert
    await tx.userConcert.delete({
      where: {
        userId_concertId: { userId, concertId: originalConcert.id },
      },
    })

    // 2. Create new concert with edited data
    const newConcert = await tx.concert.create({
      data: {
        date: input.date ?? originalConcert.date,
        latitude,
        longitude,
        venue: input.venue ?? originalConcert.venue,
        normalizedCity,
        isFestival: input.isFestival ?? originalConcert.isFestival,
        festivalId: input.festivalId ?? originalConcert.festivalId,
        createdById: userId,
        bands: {
          create: bandsToCreate.map((b, index) => ({
            bandId: b.bandId,
            isHeadliner: b.isHeadliner || false,
            sortOrder: index,
          })),
        },
        attendees: {
          create: {
            userId,
            cost: input.cost !== undefined ? input.cost : currentAttendance.cost,
            notes:
              input.notes !== undefined ? input.notes : currentAttendance.notes,
          },
        },
      },
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

    return newConcert
  })

  // 3. Check if new concert matches an existing one (merge logic)
  const newHeadliner = getHeadliner(
    result.bands.map((b) => ({ bandId: b.bandId, isHeadliner: b.isHeadliner }))
  )
  const newHeadlinerId = newHeadliner?.bandId
  const matchingConcert =
    newHeadlinerId &&
    (await findMatchingConcert(
      result.date,
      result.latitude,
      result.longitude,
      newHeadlinerId,
      result.id // Exclude the just-created concert
    ))

  if (matchingConcert) {
    // Check if user already attends the matching concert
    const existingAttendance = await prisma.userConcert.findUnique({
      where: {
        userId_concertId: { userId, concertId: matchingConcert.id },
      },
    })

    if (!existingAttendance) {
      // Migrate attendance to matching concert (preserve cost/notes)
      const userAttendance = result.attendees[0]
      await prisma.userConcert.create({
        data: {
          userId,
          concertId: matchingConcert.id,
          cost: userAttendance.cost,
          notes: userAttendance.notes,
        },
      })
    }

    // Remove from newly created concert and delete it
    await prisma.userConcert.delete({
      where: { id: result.attendees[0].id },
    })
    await prisma.concert.delete({ where: { id: result.id } })

    // Return the matching concert
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

  return await transformConcert(result, result.attendees[0])
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

  // Fetch existing concert with bands (needed for fork detection)
  const existing = await prisma.concert.findUnique({
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

  if (!existing) {
    return null
  }

  // Check if fork-triggering fields changed (date, venue/location, headliner)
  // Only headliner changes trigger fork, not supporting act changes
  const existingHeadlinerId = getHeadliner(existing.bands)?.bandId
  const inputHeadlinerId = input.bandIds
    ? getHeadliner(input.bandIds.map((b) => ({ bandId: b.bandId, isHeadliner: b.isHeadliner || false })))?.bandId
    : undefined
  const headlinerChanged =
    input.bandIds !== undefined && inputHeadlinerId !== existingHeadlinerId

  const forkTriggerFieldsChanged =
    (input.date !== undefined &&
      input.date.getTime() !== existing.date.getTime()) ||
    (input.latitude !== undefined && input.latitude !== existing.latitude) ||
    (input.longitude !== undefined && input.longitude !== existing.longitude) ||
    (input.venue !== undefined && input.venue !== existing.venue) ||
    headlinerChanged

  // Fork if multiple attendees AND fork-triggering fields changed
  if (existing._count.attendees > 1 && forkTriggerFieldsChanged) {
    return await forkConcertForUser(existing, userId, input, {
      cost: attendance.cost,
      notes: attendance.notes,
    })
  }

  // Support-act-only edit: same headliner, no core field change → update only UserConcert.bandOverrideIds
  const onlyBandsChanged =
    input.bandIds !== undefined &&
    !headlinerChanged &&
    input.date === undefined &&
    input.latitude === undefined &&
    input.longitude === undefined &&
    input.venue === undefined &&
    input.isFestival === undefined &&
    input.festivalId === undefined
  if (onlyBandsChanged) {
    const supportActOverrides: BandOverrideItem[] = input.bandIds!
      .filter((b) => b.bandId !== inputHeadlinerId)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))
    await prisma.userConcert.update({
      where: { id: attendance.id },
      data: {
        ...(input.cost !== undefined && { cost: input.cost }),
        ...(input.notes !== undefined && { notes: input.notes }),
        bandOverrideIds: supportActOverrides,
      },
    })
    const concert = await prisma.concert.findUnique({
      where: { id },
      include: {
        bands: { include: { band: true }, orderBy: { sortOrder: "asc" } },
        festival: true,
        attendees: { where: { userId } },
        _count: { select: { attendees: true } },
      },
    })
    if (!concert) return null
    const updatedAttendance = await prisma.userConcert.findUnique({
      where: { id: attendance.id },
    })
    return await transformConcert(concert, updatedAttendance ?? attendance)
  }

  // Update user-specific attendance data (only if not forking)
  if (input.cost !== undefined || input.notes !== undefined) {
    await prisma.userConcert.update({
      where: { id: attendance.id },
      data: {
        ...(input.cost !== undefined && { cost: input.cost }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    })
  }

  // Update shared concert data (any attendee can edit - only when not forking)
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
      include: { bands: { select: { bandId: true, isHeadliner: true } } },
    })

    if (updatedConcert) {
      const updatedHeadliner = updatedConcert.bands.find((b) => b.isHeadliner)
      const updatedHeadlinerId = updatedHeadliner?.bandId ?? null
      if (updatedHeadlinerId) {
        const matchingConcert = await findMatchingConcert(
          updatedConcert.date,
          updatedConcert.latitude,
          updatedConcert.longitude,
          updatedHeadlinerId,
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

/**
 * Returns effective bands for a user's concert (for edit form).
 * Merges core headliner + user's bandOverrideIds when present.
 */
export async function getEffectiveBandsForForm(
  concert: { bands: (ConcertBand & { band: PrismaBand })[] },
  attendance: { bandOverrideIds?: unknown } | null
): Promise<{ bandId: string; name: string; slug: string; isHeadliner: boolean }[]> {
  const overrideItems = attendance ? parseBandOverrideIds(attendance.bandOverrideIds) : null
  const sortedCore = concert.bands.sort(
    (a: ConcertBand & { band: PrismaBand }, b: ConcertBand & { band: PrismaBand }) => a.sortOrder - b.sortOrder
  )
  if (overrideItems !== null) {
    const headliner = sortedCore.find((cb) => cb.isHeadliner)
    const overrideBandIds = overrideItems.map((o) => o.bandId)
    const overrideBands =
      overrideBandIds.length > 0
        ? await prisma.band.findMany({ where: { id: { in: overrideBandIds } } })
        : []
    const bandsById = new Map(overrideBands.map((b) => [b.id, b]))
    return [
      ...(headliner ? [{ bandId: headliner.band.id, name: headliner.band.name, slug: headliner.band.slug, isHeadliner: true }] : []),
      ...overrideItems
        .map((o) => {
          const b = bandsById.get(o.bandId)
          return b ? { bandId: b.id, name: b.name, slug: b.slug, isHeadliner: false } : null
        })
        .filter((x): x is { bandId: string; name: string; slug: string; isHeadliner: boolean } => x != null),
    ]
  }
  return sortedCore.map((cb: ConcertBand & { band: PrismaBand }) => ({
    bandId: cb.band.id,
    name: cb.band.name,
    slug: cb.band.slug,
    isHeadliner: cb.isHeadliner,
  }))
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

      // Most seen bands for user's attended concerts (effective bands: core + bandOverrideIds)
      (async () => {
        type Row = { band_id: string; cnt: bigint }
        try {
          const rows = await prisma.$queryRaw<Row[]>`
          WITH user_concerts AS (
            SELECT uc."concertId", uc."bandOverrideIds", c."date"
            FROM user_concert uc
            JOIN concert c ON c.id = uc."concertId"
            WHERE uc."userId" = ${userId} AND c."date" < ${now}
          ),
          effective_bands AS (
            SELECT uc."concertId", cb."bandId" AS band_id
            FROM user_concerts uc
            JOIN concert_band cb ON cb."concertId" = uc."concertId"
            WHERE uc."bandOverrideIds" IS NULL
            UNION ALL
            SELECT uc."concertId", cb."bandId" AS band_id
            FROM user_concerts uc
            JOIN concert_band cb ON cb."concertId" = uc."concertId" AND cb."isHeadliner" = true
            WHERE uc."bandOverrideIds" IS NOT NULL
            UNION ALL
            SELECT uc."concertId", (elem->>'bandId')::text AS band_id
            FROM user_concerts uc, jsonb_array_elements(uc."bandOverrideIds") AS elem
            WHERE uc."bandOverrideIds" IS NOT NULL
          )
          SELECT band_id, COUNT(*)::bigint AS cnt
          FROM effective_bands
          WHERE band_id IS NOT NULL
          GROUP BY band_id
          ORDER BY cnt DESC
          LIMIT 10
        `
          const bandIds = rows.map((r) => r.band_id)
          if (bandIds.length === 0)
            return [] as [string, number, string][]
          const bands = await prisma.band.findMany({
            where: { id: { in: bandIds } },
            select: { id: true, name: true, slug: true },
          })
          return rows
            .map((r) => {
              const band = bands.find((b) => b.id === r.band_id)
              const count = Number(r.cnt)
              return band && count > 0 ? ([band.name, count, band.slug] as [string, number, string]) : null
            })
            .filter((x): x is [string, number, string] => x != null)
            .slice(0, 5)
        } catch {
          // Fallback when bandOverrideIds column does not exist (migration not run)
          const results = await prisma.concertBand.groupBy({
            by: ["bandId"],
            where: { concertId: { in: concertIds } },
            _count: true,
            orderBy: { _count: { bandId: "desc" } },
            take: 10,
          })
          const bandIds = results.map((r) => r.bandId)
          if (bandIds.length === 0) return [] as [string, number, string][]
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
        }
      })(),

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
