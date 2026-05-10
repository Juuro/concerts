import { prisma } from "../../prisma"
import { type UserConcert } from "@/generated/prisma/client"
import { getGeocodingData } from "@/utils/data"
import type {
  CreateConcertInput,
  SupportingActItem,
  TransformedConcert,
} from "../types"
import { type ConcertWithRelations, transformConcert } from "../transform"
import {
  findMatchingConcert,
  getHeadlinerBandIdsInOrder,
  getPrimaryHeadlinerBandId,
} from "../matching"
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
  const headlinerBandId = getPrimaryHeadlinerBandId(input.bandIds)

  let concert: ConcertWithRelations
  let userConcert: UserConcert

  if (headlinerBandId) {
    // Try to find an existing concert with same date, location, and primary headliner
    const existingConcert = await findMatchingConcert(
      input.date,
      input.latitude,
      input.longitude,
      headlinerBandId
    )

    if (existingConcert) {
      const existingWithBands = await prisma.concert.findUnique({
        where: { id: existingConcert.id },
        include: {
          bands: { include: { band: true }, orderBy: { sortOrder: "asc" } },
          festival: true,
          _count: { select: { attendees: true } },
        },
      })
      if (!existingWithBands) throw new Error("Concert not found")

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

      const orderedHeadliners = getHeadlinerBandIdsInOrder(input.bandIds)
      const supportingActIds: SupportingActItem[] = input.bandIds
        .filter((b) => !b.isHeadliner)
        .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))

      // Check if the existing concert has other attendees
      const hasOtherAttendees = existingWithBands._count.attendees > 0

      // Get existing headliner band IDs in order
      const existingHeadlinerIds = existingWithBands.bands
        .filter((cb) => cb.isHeadliner)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((cb) => cb.bandId)

      // Check if headliner set and order match
      const headlinersMatch =
        orderedHeadliners.length === existingHeadlinerIds.length &&
        orderedHeadliners.every((id, i) => id === existingHeadlinerIds[i])

      // If there are other attendees AND headliners don't match, create a new concert (fork)
      // to avoid mutating shared data for other users
      if (hasOtherAttendees && !headlinersMatch) {
        concert = await createNewConcertWithUser(input)
        userConcert = concert.attendees![0]
      } else {
        // Safe to link: either no other attendees, or headliners already match
        userConcert = await prisma.$transaction(async (tx) => {
          // Only upsert headliners if they don't already match (no other attendees case)
          if (!headlinersMatch) {
            for (let i = 0; i < orderedHeadliners.length; i++) {
              const bandId = orderedHeadliners[i]
              await tx.concertBand.upsert({
                where: {
                  concertId_bandId: {
                    concertId: existingConcert.id,
                    bandId,
                  },
                },
                create: {
                  concertId: existingConcert.id,
                  bandId,
                  isHeadliner: true,
                  sortOrder: i,
                },
                update: {
                  isHeadliner: true,
                  sortOrder: i,
                },
              })
            }
          }

          return tx.userConcert.create({
            data: {
              userId: input.userId,
              concertId: existingConcert.id,
              cost: input.cost !== undefined ? input.cost : undefined,
              supportingActIds,
            },
          })
        })

        const refreshed = await prisma.concert.findUnique({
          where: { id: existingConcert.id },
          include: {
            bands: { include: { band: true }, orderBy: { sortOrder: "asc" } },
            festival: true,
            _count: { select: { attendees: true } },
          },
        })
        if (!refreshed) throw new Error("Concert not found")
        concert = refreshed
      }
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

  const headlinerRows = input.bandIds.filter((b) => b.isHeadliner)

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
      bands:
        headlinerRows.length > 0
          ? {
              create: headlinerRows.map((b, index) => ({
                bandId: b.bandId,
                isHeadliner: true,
                sortOrder: index,
              })),
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
