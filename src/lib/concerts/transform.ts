import { prisma } from "../prisma"
import {
  type Concert as PrismaConcert,
  type Band as PrismaBand,
  type Festival as PrismaFestival,
  type ConcertBand,
  type UserConcert,
} from "@/generated/prisma/client"
import type { GeocodingData } from "@/types/geocoding"
import type {
  SupportingActItem,
  TransformedBand,
  TransformedConcert,
} from "./types"

/**
 * Parses supportingActIds from UserConcert.
 * - Returns null when field is missing/invalid (legacy data - needs migration).
 * - Returns [] when user has no support acts: show headliner only.
 * - Returns [...] when user has specific support acts: show headliner + these.
 */
export function parseSupportingActIds(raw: unknown): SupportingActItem[] | null {
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
    (a: ConcertBand & { band: PrismaBand }, b: ConcertBand & { band: PrismaBand }) =>
      a.sortOrder - b.sortOrder,
  )
  const headliner = coreBands.find((cb) => cb.isHeadliner)
  const headlinerBand = headliner ? bandToTransformed(headliner.band, true) : null

  const supportingActs = attendance
    ? parseSupportingActIds((attendance as { supportingActIds?: unknown }).supportingActIds)
    : null
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
export async function transformConcertsBatch(
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
          (
            await prisma.band.findMany({
              where: { id: { in: [...allBandIds] } },
            })
          ).map((b) => [b.id, b]),
        )
      : new Map()

  return items.map(({ concert, attendance }) =>
    transformConcertSync(concert, attendance ?? null, prefetchedBands),
  )
}

/** Legacy single-concert transform (still needed by createConcert/updateConcert). */
export async function transformConcert(
  concert: ConcertWithAttendance,
  userAttendance?: UserConcert | null,
): Promise<TransformedConcert> {
  const supportingActs = (userAttendance ?? concert.userAttendance)
    ? parseSupportingActIds(
        ((userAttendance ?? concert.userAttendance) as { supportingActIds?: unknown })
          .supportingActIds,
      )
    : null
  const bandIds = supportingActs?.map((o) => o.bandId) ?? []
  const prefetchedBands: Map<string, PrismaBand> =
    bandIds.length > 0
      ? new Map(
          (
            await prisma.band.findMany({
              where: { id: { in: bandIds } },
            })
          ).map((b) => [b.id, b]),
        )
      : new Map()

  return transformConcertSync(concert, userAttendance ?? null, prefetchedBands)
}

