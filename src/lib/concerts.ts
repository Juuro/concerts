import { prisma } from "./prisma"
import { cacheLife, cacheTag } from "next/cache"
import {
  Prisma,
  type Concert as PrismaConcert,
  type Band as PrismaBand,
  type Festival as PrismaFestival,
  type ConcertBand,
  type UserConcert,
} from "@/generated/prisma/client"
import { cityToSlug } from "@/utils/helpers"
import { getGeocodingData } from "@/utils/data"
import type { GeocodingData } from "@/types/geocoding"

// Coordinate tolerance for matching concerts (~100m)
const COORD_TOLERANCE = 0.001

/** Thrown when the user already has this concert in their list (matched by date/location/headliner). */
export class ConcertAlreadyExistsError extends Error {
  constructor(public concertId: string) {
    super("Concert already in list")
    this.name = "ConcertAlreadyExistsError"
  }
}

/** User-specific support act: bandId + sortOrder. Per-user, not shared. */
export type SupportingActItem = { bandId: string; sortOrder: number }

/**
 * Parses supportingActIds from UserConcert.
 * - Returns null when field is missing/invalid (legacy data - needs migration).
 * - Returns [] when user has no support acts: show headliner only.
 * - Returns [...] when user has specific support acts: show headliner + these.
 */
function parseSupportingActIds(raw: unknown): SupportingActItem[] | null {
  if (raw == null || !Array.isArray(raw)) return null
  const arr = raw as unknown[]
  const out: SupportingActItem[] = []
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

function buildGeocodingFromConcert(concert: ConcertWithAttendance): GeocodingData {
  if (concert.normalizedCity) {
    return { _normalized_city: concert.normalizedCity }
  }
  return {
    _normalized_city: `${concert.latitude.toFixed(3)}, ${concert.longitude.toFixed(3)}`,
    _is_coordinates: true,
  }
}

/**
 * Transform a single concert. Accepts an optional pre-fetched band map
 * to avoid per-concert DB queries for supporting acts.
 */
function transformConcertSync(
  concert: ConcertWithAttendance,
  userAttendance: UserConcert | null | undefined,
  prefetchedBands: Map<string, PrismaBand>,
): TransformedConcert {
  const geocodingData = buildGeocodingFromConcert(concert)

  const attendance = userAttendance ?? concert.userAttendance

  const coreBands = concert.bands.sort(
    (a: ConcertBand & { band: PrismaBand }, b: ConcertBand & { band: PrismaBand }) => a.sortOrder - b.sortOrder
  )
  const headliner = coreBands.find((cb) => cb.isHeadliner)
  const headlinerBand = headliner
    ? bandToTransformed(headliner.band, true)
    : null

  const supportingActs = attendance ? parseSupportingActIds((attendance as { supportingActIds?: unknown }).supportingActIds) : null
  const supportingActBands = (supportingActs ?? [])
    .map((o) => prefetchedBands.get(o.bandId))
    .filter((b): b is PrismaBand => b != null)

  const bands: TransformedBand[] = [
    ...(headlinerBand ? [headlinerBand] : []),
    ...supportingActBands.map((b) => bandToTransformed(b, false)),
  ]

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

  if (attendance) {
    transformed.attendance = {
      id: attendance.id,
      userId: attendance.userId,
      cost: attendance.cost ? attendance.cost.toString() : null,
      notes: attendance.notes,
    }
    transformed.userId = attendance.userId
    transformed.cost = attendance.cost ? attendance.cost.toString() : null
  }

  if (concert._count?.attendees !== undefined) {
    transformed.attendeeCount = concert._count.attendees
  }

  return transformed
}

/**
 * Batch-transform concerts: collects all supporting act band IDs,
 * fetches them in ONE query, then transforms synchronously.
 */
async function transformConcertsBatch(
  items: Array<{ concert: ConcertWithAttendance; attendance?: UserConcert | null }>,
): Promise<TransformedConcert[]> {
  const allBandIds = new Set<string>()
  for (const { concert, attendance: att } of items) {
    const uc = att ?? concert.userAttendance
    if (uc) {
      const acts = parseSupportingActIds((uc as { supportingActIds?: unknown }).supportingActIds)
      if (acts) {
        for (const a of acts) allBandIds.add(a.bandId)
      }
    }
  }

  const prefetchedBands: Map<string, PrismaBand> =
    allBandIds.size > 0
      ? new Map(
          (await prisma.band.findMany({ where: { id: { in: [...allBandIds] } } }))
            .map((b) => [b.id, b])
        )
      : new Map()

  return items.map(({ concert, attendance }) =>
    transformConcertSync(concert, attendance ?? null, prefetchedBands)
  )
}

/** Legacy single-concert transform (still needed by createConcert/updateConcert). */
async function transformConcert(
  concert: ConcertWithAttendance,
  userAttendance?: UserConcert | null
): Promise<TransformedConcert> {
  const supportingActs = (userAttendance ?? concert.userAttendance)
    ? parseSupportingActIds(((userAttendance ?? concert.userAttendance) as { supportingActIds?: unknown }).supportingActIds)
    : null
  const bandIds = supportingActs?.map((o) => o.bandId) ?? []
  const prefetchedBands: Map<string, PrismaBand> =
    bandIds.length > 0
      ? new Map((await prisma.band.findMany({ where: { id: { in: bandIds } } })).map((b) => [b.id, b]))
      : new Map()
  return transformConcertSync(concert, userAttendance ?? null, prefetchedBands)
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

      // Check if user already attends this concert (avoid unique constraint)
      const existingAttendance = await prisma.userConcert.findUnique({
        where: {
          userId_concertId: { userId: input.userId, concertId: existingConcert.id },
        },
      })
      if (existingAttendance) {
        throw new ConcertAlreadyExistsError(existingConcert.id)
      }

      // Always set supportingActIds for linkers so they never see core support acts
      const supportingActIds: SupportingActItem[] = input.bandIds
        .filter((b) => b.bandId !== headlinerBandId)
        .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))

      userConcert = await prisma.userConcert.create({
        data: {
          userId: input.userId,
          concertId: existingConcert.id,
          cost: input.cost !== undefined ? input.cost : undefined,
          supportingActIds,
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

  // Find the headliner band
  const headliner = input.bandIds.find((b) => b.isHeadliner)

  // Support acts are all non-headliner bands (stored in UserConcert, not ConcertBand)
  const supportingActIds: SupportingActItem[] = input.bandIds
    .filter((b) => !b.isHeadliner)
    .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))

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
      // Only store headliner in ConcertBand (shared)
      bands: headliner
        ? {
            create: {
              bandId: headliner.bandId,
              isHeadliner: true,
              sortOrder: 0,
            },
          }
        : undefined,
      attendees: {
        create: {
          userId: input.userId,
          cost: input.cost !== undefined ? input.cost : undefined,
          // Store support acts in UserConcert (per-user)
          supportingActIds,
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
  currentAttendance: { cost: any; notes: string | null; supportingActIds: unknown }
): Promise<TransformedConcert> {
  // Get geocoding data for the new location
  const latitude = input.latitude ?? originalConcert.latitude
  const longitude = input.longitude ?? originalConcert.longitude
  const geocodingData = await getGeocodingData(latitude, longitude)
  const normalizedCity =
    geocodingData?._normalized_city && !geocodingData._is_coordinates
      ? geocodingData._normalized_city
      : null

  // Determine the user's band selection for the fork
  // Priority: input.bandIds > user's current view (headliner + supportingActIds)
  let headlinerBandId: string | undefined
  let supportingActIds: SupportingActItem[]

  if (input.bandIds) {
    // User is changing bands - use their new selection
    const headliner = input.bandIds.find((b) => b.isHeadliner)
    headlinerBandId = headliner?.bandId
    supportingActIds = input.bandIds
      .filter((b) => !b.isHeadliner)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))
  } else {
    // User is NOT changing bands - preserve their current view
    // Headliner from original concert's ConcertBand
    const originalHeadliner = originalConcert.bands.find((b) => b.isHeadliner)
    headlinerBandId = originalHeadliner?.bandId
    // Support acts from user's supportingActIds (per-user data)
    supportingActIds = parseSupportingActIds(currentAttendance.supportingActIds) ?? []
  }

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Remove user from original concert
    await tx.userConcert.delete({
      where: {
        userId_concertId: { userId, concertId: originalConcert.id },
      },
    })

    // 2. Create new concert with edited data
    // Only headliner goes in ConcertBand (shared), support acts go in UserConcert (per-user)
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
        bands: headlinerBandId
          ? {
              create: {
                bandId: headlinerBandId,
                isHeadliner: true,
                sortOrder: 0,
              },
            }
          : undefined,
        attendees: {
          create: {
            userId,
            cost: input.cost !== undefined ? input.cost : currentAttendance.cost,
            notes:
              input.notes !== undefined ? input.notes : currentAttendance.notes,
            supportingActIds,
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
      // Migrate attendance to matching concert (preserve user's supportingActIds)
      const userAttendance = result.attendees[0]
      await prisma.userConcert.create({
        data: {
          userId,
          concertId: matchingConcert.id,
          cost: userAttendance.cost,
          notes: userAttendance.notes,
          supportingActIds: userAttendance.supportingActIds ?? [],
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
      supportingActIds: attendance.supportingActIds,
    })
  }

  // Support-act-only edit: same headliner, no core field change → update only UserConcert.supportingActIds
  const noCoreFieldChanged =
    (input.date === undefined ||
      input.date.getTime() === existing.date.getTime()) &&
    (input.latitude === undefined || input.latitude === existing.latitude) &&
    (input.longitude === undefined || input.longitude === existing.longitude) &&
    (input.venue === undefined || input.venue === existing.venue) &&
    (input.isFestival === undefined ||
      input.isFestival === existing.isFestival) &&
    (input.festivalId === undefined ||
      (input.festivalId ?? null) === (existing.festivalId ?? null))

  const onlyBandsChanged =
    input.bandIds !== undefined && !headlinerChanged && noCoreFieldChanged
  if (onlyBandsChanged) {
    const supportActOverrides: SupportingActItem[] = input.bandIds!
      .filter((b) => b.bandId !== inputHeadlinerId)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))
    await prisma.userConcert.update({
      where: { id: attendance.id },
      data: {
        ...(input.cost !== undefined && { cost: input.cost }),
        ...(input.notes !== undefined && { notes: input.notes }),
        supportingActIds: supportActOverrides,
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

  // Hard guard: for multi-attendee concerts, band changes must always be per-user.
  // This prevents core ConcertBand corruption if noCoreFieldChanged comparison fails
  // (e.g. floating-point precision, date representation, null vs empty-string).
  if (existing._count.attendees > 1 && input.bandIds && !headlinerChanged) {
    const headlinerId = inputHeadlinerId ?? existingHeadlinerId
    const supportActOverrides: SupportingActItem[] = input.bandIds
      .filter((b) => b.bandId !== headlinerId)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))
    await prisma.userConcert.update({
      where: { id: attendance.id },
      data: { supportingActIds: supportActOverrides },
    })
    input = { ...input, bandIds: undefined }
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

  // If updating bands (single-attendee concert), only headliner goes in ConcertBand
  // Support acts go in UserConcert.supportingActIds
  if (input.bandIds) {
    const newHeadliner = input.bandIds.find((b) => b.isHeadliner)
    const newSupportingActs: SupportingActItem[] = input.bandIds
      .filter((b) => !b.isHeadliner)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))

    // Update user's supportingActIds
    await prisma.userConcert.update({
      where: { id: attendance.id },
      data: { supportingActIds: newSupportingActs },
    })

    // Delete existing ConcertBand entries and create only headliner
    await prisma.concertBand.deleteMany({
      where: { concertId: id },
    })
    if (newHeadliner) {
      await prisma.concertBand.create({
        data: {
          concertId: id,
          bandId: newHeadliner.bandId,
          isHeadliner: true,
          sortOrder: 0,
        },
      })
    }

    // Remove bandIds from input so it doesn't get processed again below
    input = { ...input, bandIds: undefined }
  }

  // Update shared concert data (any attendee can edit - only when not forking)
  const hasSharedUpdates =
    input.date !== undefined ||
    input.latitude !== undefined ||
    input.longitude !== undefined ||
    input.venue !== undefined ||
    input.isFestival !== undefined ||
    input.festivalId !== undefined

  if (hasSharedUpdates) {
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
            // Migrate attendance to matching concert (preserve cost/notes/supportingActIds)
            await prisma.userConcert.create({
              data: {
                userId,
                concertId: matchingConcert.id,
                cost: currentAttendance.cost,
                notes: currentAttendance.notes,
                supportingActIds: currentAttendance.supportingActIds ?? undefined,
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
 * Headliner comes from ConcertBand (shared), support acts from UserConcert.supportingActIds (per-user).
 */
export async function getEffectiveBandsForForm(
  concert: { bands: (ConcertBand & { band: PrismaBand })[] },
  attendance: { supportingActIds?: unknown } | null
): Promise<{ bandId: string; name: string; slug: string; isHeadliner: boolean }[]> {
  // Headliner always comes from ConcertBand (shared)
  const sortedCore = concert.bands.sort(
    (a: ConcertBand & { band: PrismaBand }, b: ConcertBand & { band: PrismaBand }) => a.sortOrder - b.sortOrder
  )
  const headliner = sortedCore.find((cb) => cb.isHeadliner)

  // Support acts always come from UserConcert.supportingActIds (per-user)
  const supportingActs = attendance ? parseSupportingActIds(attendance.supportingActIds) : null
  const supportingActBandIds = supportingActs?.map((o) => o.bandId) ?? []
  const supportingActBands =
    supportingActBandIds.length > 0
      ? await prisma.band.findMany({ where: { id: { in: supportingActBandIds } } })
      : []
  const bandsById = new Map(supportingActBands.map((b) => [b.id, b]))

  return [
    ...(headliner ? [{ bandId: headliner.band.id, name: headliner.band.name, slug: headliner.band.slug, isHeadliner: true }] : []),
    ...(supportingActs ?? [])
      .map((o) => {
        const b = bandsById.get(o.bandId)
        return b ? { bandId: b.id, name: b.name, slug: b.slug, isHeadliner: false } : null
      })
      .filter((x): x is { bandId: string; name: string; slug: string; isHeadliner: boolean } => x != null),
  ]
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
    items: await transformConcertsBatch(items.map((c) => ({ concert: c }))),
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

/**
 * Band-filtered pagination: headliner OR supporting act.
 * Uses raw SQL because supportingActIds is JSON and Prisma cannot filter it.
 */
async function getConcertsPaginatedForUserByBand(
  cursor: string | undefined,
  limit: number,
  direction: "forward" | "backward",
  filters: ConcertFilters,
  bandId: string
): Promise<PaginatedConcerts> {
  const take = limit + 1
  type Row = { id: string }

  // Get cursor's concert date for keyset pagination
  let cursorDate: Date | null = null
  if (cursor) {
    const uc = await prisma.userConcert.findUnique({
      where: { id: cursor, userId: filters.userId! },
      select: { concert: { select: { date: true } } },
    })
    cursorDate = uc?.concert?.date ?? null
  }

  const yearClause =
    filters.year != null
      ? Prisma.sql`AND c."date" >= ${new Date(filters.year, 0, 1)} AND c."date" <= ${new Date(filters.year, 11, 31, 23, 59, 59, 999)}`
      : Prisma.empty
  const cityClause =
    filters.city != null
      ? Prisma.sql`AND c."normalizedCity" = ${filters.city}`
      : Prisma.empty

  const isForward = direction === "forward"
  const cursorClause =
    cursor && cursorDate
      ? isForward
        ? Prisma.sql`AND (c."date", uc.id) < (${cursorDate}, ${cursor})`
        : Prisma.sql`AND (c."date", uc.id) > (${cursorDate}, ${cursor})`
      : Prisma.empty
  const orderClause = isForward
    ? Prisma.sql`ORDER BY c."date" DESC, uc.id DESC`
    : Prisma.sql`ORDER BY c."date" ASC, uc.id ASC`

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT uc.id
    FROM user_concert uc
    JOIN concert c ON c.id = uc."concertId"
    WHERE uc."userId" = ${filters.userId}
      AND (
        EXISTS (
          SELECT 1 FROM concert_band cb
          WHERE cb."concertId" = c.id AND cb."bandId" = ${bandId}
        )
        OR (
          uc."supportingActIds" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(uc."supportingActIds") AS elem
            WHERE (elem->>'bandId') = ${bandId}
          )
        )
      )
      ${yearClause}
      ${cityClause}
      ${cursorClause}
    ${orderClause}
    LIMIT ${take}
  `

  const ids = rows.map((r) => r.id)
  if (ids.length === 0) {
    return {
      items: [],
      nextCursor: null,
      prevCursor: cursor ?? null,
      hasMore: false,
      hasPrevious: Boolean(cursor),
    }
  }

  const userConcerts = await prisma.userConcert.findMany({
    where: { id: { in: ids } },
    include: {
      concert: {
        include: {
          bands: {
            include: { band: true },
            orderBy: { sortOrder: "asc" as const },
          },
          festival: true,
          _count: { select: { attendees: true } },
        },
      },
    },
  })

  const orderMap = new Map(ids.map((id, i) => [id, i]))
  userConcerts.sort((a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!)

  const hasExtra = userConcerts.length > limit
  const items = hasExtra ? userConcerts.slice(0, limit) : userConcerts

  if (direction === "backward") {
    items.reverse()
  }

  return {
    items: await transformConcertsBatch(
      items.map((uc) => ({ concert: uc.concert, attendance: uc }))
    ),
    nextCursor:
      direction === "forward"
        ? hasExtra
          ? items[items.length - 1].id
          : null
        : cursor
          ? items[items.length - 1]?.id ?? null
          : null,
    prevCursor:
      direction === "forward"
        ? cursor
          ? items[0]?.id ?? null
          : null
        : hasExtra
          ? items[0]?.id ?? null
          : null,
    hasMore: direction === "forward" ? hasExtra : Boolean(cursor),
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
  // Band filter requires raw SQL (headliner OR supportingActIds)
  if (filters.bandSlug && filters.userId) {
    const band = await prisma.band.findUnique({
      where: { slug: filters.bandSlug },
      select: { id: true },
    })
    if (band) {
      return getConcertsPaginatedForUserByBand(
        cursor,
        limit,
        direction,
        filters,
        band.id
      )
    }
  }

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
    items: await transformConcertsBatch(
      items.map((uc) => ({ concert: uc.concert, attendance: uc }))
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

/**
 * Count user's concerts for a band (headliner or supporting act).
 * Includes both ConcertBand (headliner) and UserConcert.supportingActIds.
 */
export async function getUserBandConcertCounts(
  userId: string,
  bandId: string,
  now: Date
): Promise<ConcertCounts> {
  type Row = { past_count: bigint; future_count: bigint }
  const rows = await prisma.$queryRaw<Row[]>`
    WITH band_matches AS (
      SELECT uc.id, c."date"
      FROM user_concert uc
      JOIN concert c ON c.id = uc."concertId"
      WHERE uc."userId" = ${userId}
        AND (
          EXISTS (
            SELECT 1 FROM concert_band cb
            WHERE cb."concertId" = c.id AND cb."bandId" = ${bandId}
          )
          OR (
            uc."supportingActIds" IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(uc."supportingActIds") AS elem
              WHERE (elem->>'bandId') = ${bandId}
            )
          )
        )
    )
    SELECT
      COUNT(*) FILTER (WHERE "date" < ${now})::bigint AS past_count,
      COUNT(*) FILTER (WHERE "date" >= ${now})::bigint AS future_count
    FROM band_matches
  `
  const r = rows[0]
  return {
    past: r ? Number(r.past_count) : 0,
    future: r ? Number(r.future_count) : 0,
  }
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

export async function getConcertStatistics() {
  "use cache"
  cacheTag("concert-statistics")
  cacheLife("hours")
  return computeConcertStatistics()
}

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

      // Most seen bands for user's attended concerts (effective bands: core + supportingActIds)
      (async () => {
        type Row = { band_id: string; cnt: bigint }
        try {
          const rows = await prisma.$queryRaw<Row[]>`
          WITH user_concerts AS (
            SELECT uc."concertId", uc."supportingActIds", c."date"
            FROM user_concert uc
            JOIN concert c ON c.id = uc."concertId"
            WHERE uc."userId" = ${userId} AND c."date" < ${now}
          ),
          effective_bands AS (
            SELECT uc."concertId", cb."bandId" AS band_id
            FROM user_concerts uc
            JOIN concert_band cb ON cb."concertId" = uc."concertId"
            WHERE uc."supportingActIds" IS NULL
            UNION ALL
            SELECT uc."concertId", cb."bandId" AS band_id
            FROM user_concerts uc
            JOIN concert_band cb ON cb."concertId" = uc."concertId" AND cb."isHeadliner" = true
            WHERE uc."supportingActIds" IS NOT NULL
            UNION ALL
            SELECT uc."concertId", (elem->>'bandId')::text AS band_id
            FROM user_concerts uc, jsonb_array_elements(uc."supportingActIds") AS elem
            WHERE uc."supportingActIds" IS NOT NULL
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
          // Fallback when supportingActIds column does not exist (migration not run)
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

export async function getUserConcertStatistics(userId: string) {
  "use cache"
  cacheTag("user-concert-statistics")
  cacheLife("hours")
  return computeUserConcertStatistics(userId)
}

export async function getUserConcertCounts(
  userId: string
): Promise<ConcertCounts> {
  "use cache"
  cacheTag(`user-concert-counts-${userId}`)
  cacheLife("minutes")
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

/** Efficient aggregate: unique cities + unique years for the homepage dashboard. */
export async function getUserDashboardCounts(userId: string) {
  "use cache"
  cacheTag(`user-dashboard-counts-${userId}`)
  cacheLife("minutes")
  type Row = { unique_cities: bigint; unique_years: bigint }
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      COUNT(DISTINCT c."normalizedCity") FILTER (WHERE c."normalizedCity" IS NOT NULL)::bigint AS unique_cities,
      COUNT(DISTINCT EXTRACT(YEAR FROM c.date))::bigint AS unique_years
    FROM concert c
    WHERE EXISTS (
      SELECT 1 FROM user_concert uc WHERE uc."concertId" = c.id AND uc."userId" = ${userId}
    )
  `
  return {
    uniqueCities: Number(rows[0]?.unique_cities ?? 0),
    uniqueYears: Number(rows[0]?.unique_years ?? 0),
  }
}

/**
 * Counts distinct bands (headliners + supporting acts) for a user's concerts.
 * Includes all user concerts (past and future).
 */
export async function getUserUniqueBandCount(userId: string): Promise<number> {
  "use cache"
  cacheTag(`user-unique-bands-${userId}`)
  cacheLife("minutes")
  type Row = { cnt: bigint }
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      WITH user_concerts AS (
        SELECT uc."concertId", uc."supportingActIds"
        FROM user_concert uc
        WHERE uc."userId" = ${userId}
      ),
      effective_bands AS (
        SELECT cb."bandId" AS band_id
        FROM user_concerts uc
        JOIN concert_band cb ON cb."concertId" = uc."concertId"
        WHERE uc."supportingActIds" IS NULL
        UNION
        SELECT cb."bandId" AS band_id
        FROM user_concerts uc
        JOIN concert_band cb ON cb."concertId" = uc."concertId" AND cb."isHeadliner" = true
        WHERE uc."supportingActIds" IS NOT NULL
        UNION
        SELECT (elem->>'bandId')::text AS band_id
        FROM user_concerts uc, jsonb_array_elements(uc."supportingActIds") AS elem
        WHERE uc."supportingActIds" IS NOT NULL
      )
      SELECT COUNT(*)::bigint AS cnt
      FROM (SELECT DISTINCT band_id FROM effective_bands WHERE band_id IS NOT NULL) AS unique_bands
    `
    return Number(rows[0]?.cnt ?? 0)
  } catch {
    const results = await prisma.concertBand.groupBy({
      by: ["bandId"],
      where: { concert: { attendees: { some: { userId } } } },
    })
    return results.length
  }
}

export async function getGlobalAppStats() {
  "use cache"
  cacheTag("global-app-stats")
  cacheLife("hours")
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
  filters?: {
    bandSlug?: string
    city?: string
    year?: number
    pastOnly?: boolean
  }
): Promise<{ total: number; currency: string }> {
  const now = getStartOfToday()

  // Band filter requires raw SQL (headliner OR supportingActIds)
  if (filters?.bandSlug) {
    const band = await prisma.band.findUnique({
      where: { slug: filters.bandSlug },
      select: { id: true },
    })
    if (band) {
      type Row = { total: number | null }
      const yearClause =
        filters.year != null
          ? Prisma.sql`AND c."date" >= ${new Date(filters.year, 0, 1)} AND c."date" <= ${new Date(filters.year, 11, 31, 23, 59, 59, 999)}`
          : Prisma.empty
      const cityClause =
        filters.city != null
          ? Prisma.sql`AND c."normalizedCity" = ${filters.city}`
          : Prisma.empty
      const pastClause = filters.pastOnly ? Prisma.sql`AND c."date" < ${now}` : Prisma.empty

      const rows = await prisma.$queryRaw<Row[]>`
        SELECT COALESCE(SUM(uc.cost), 0)::float AS total
        FROM user_concert uc
        JOIN concert c ON c.id = uc."concertId"
        WHERE uc."userId" = ${userId}
          AND uc.cost IS NOT NULL
          ${pastClause}
          AND (
            EXISTS (
              SELECT 1 FROM concert_band cb
              WHERE cb."concertId" = c.id AND cb."bandId" = ${band.id}
            )
            OR (
              uc."supportingActIds" IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(uc."supportingActIds") AS elem
                WHERE (elem->>'bandId') = ${band.id}
              )
            )
          )
          ${yearClause}
          ${cityClause}
      `
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { currency: true },
      })
      return {
        total: Number(rows[0]?.total ?? 0),
        currency: user?.currency || "EUR",
      }
    }
  }

  // Build concert filter conditions (Prisma path)
  const concertWhere: any = {}
  if (filters?.city) {
    concertWhere.normalizedCity = filters.city
  }
  if (filters?.year) {
    const yearStart = new Date(filters.year, 0, 1)
    const yearEnd = new Date(filters.year, 11, 31, 23, 59, 59, 999)
    concertWhere.date = { gte: yearStart, lte: yearEnd }
  }
  if (filters?.pastOnly) {
    concertWhere.date = concertWhere.date
      ? { ...concertWhere.date, lt: now }
      : { lt: now }
  }

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

/** Cached variant: total past spending for homepage dashboard. */
export async function getUserTotalSpentCached(
  userId: string
): Promise<{ total: number; currency: string }> {
  "use cache"
  cacheTag(`user-total-spent-${userId}`)
  cacheLife("minutes")
  return getUserTotalSpent(userId, { pastOnly: true })
}
