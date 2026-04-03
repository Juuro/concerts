import { prisma } from "../../prisma"
import { type UserConcert } from "@/generated/prisma/client"
import { getGeocodingData } from "@/utils/data"
import type {
  CreateConcertInput,
  SupportingActItem,
  TransformedConcert,
} from "../types"
import { type ConcertWithRelations, transformConcert } from "../transform"
import { findMatchingConcert, getHeadliner } from "../matching"
import { ConcertAlreadyExistsError } from "../errors"

/**
 * Create a new concert for a user.
 * - If there's a matching shared concert, link the user via `UserConcert` (supportingActIds).
 * - Otherwise create a new shared `Concert` + user `UserConcert`.
 * - Preserves exact duplicate detection + transformation behavior.
 */
export async function createConcert(
  input: CreateConcertInput
): Promise<TransformedConcert> {
  const headliner = getHeadliner(
    input.bandIds.map((b) => ({
      bandId: b.bandId,
      isHeadliner: b.isHeadliner ?? false,
    }))
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
          userId_concertId: {
            userId: input.userId,
            concertId: existingConcert.id,
          },
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
