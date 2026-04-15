import { prisma } from "../../prisma"
import {
  type Concert as PrismaConcert,
  type Band as PrismaBand,
  type Festival as PrismaFestival,
  type ConcertBand,
  type UserConcert,
} from "@/generated/prisma/client"
import { getGeocodingData } from "@/utils/data"
import type {
  SupportingActItem,
  TransformedConcert,
  UpdateConcertInput,
} from "../types"
import { parseSupportingActIds, transformConcert } from "../transform"
import {
  findMatchingConcert,
  getHeadliner,
  getHeadlinerBandIdsInOrder,
  getHeadlinerIdsFromConcertBands,
  headlinerOrdersEqual,
  headlinerSetsEqual,
} from "../matching"

type ConcertWithRelations = PrismaConcert & {
  bands: (ConcertBand & { band: PrismaBand })[]
  festival: PrismaFestival | null
  attendees?: UserConcert[]
  _count?: { attendees: number }
}

/**
 * Fork a concert for a user when they edit fork-triggering fields
 * on a multi-attendee concert.
 */
async function forkConcertForUser(
  originalConcert: ConcertWithRelations,
  userId: string,
  input: UpdateConcertInput,
  currentAttendance: {
    cost: any
    notes: string | null
    supportingActIds: unknown
  }
): Promise<TransformedConcert> {
  // Get geocoding data for the new location
  const latitude = input.latitude ?? originalConcert.latitude
  const longitude = input.longitude ?? originalConcert.longitude
  const geocodingData = await getGeocodingData(latitude, longitude)
  const normalizedCity =
    geocodingData?._normalized_city && !geocodingData._is_coordinates
      ? geocodingData._normalized_city
      : null

  let orderedHeadlinerBandIds: string[]
  let supportingActIds: SupportingActItem[]

  if (input.bandIds) {
    orderedHeadlinerBandIds = getHeadlinerBandIdsInOrder(input.bandIds)
    supportingActIds = input.bandIds
      .filter((b) => !b.isHeadliner)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))
  } else {
    orderedHeadlinerBandIds = [...originalConcert.bands]
      .filter((b) => b.isHeadliner)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b) => b.bandId)
    supportingActIds =
      parseSupportingActIds(currentAttendance.supportingActIds) ?? []
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
    // All co-headliners in ConcertBand (shared); support acts in UserConcert (per-user)
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
        bands:
          orderedHeadlinerBandIds.length > 0
            ? {
                create: orderedHeadlinerBandIds.map((bandId, index) => ({
                  bandId,
                  isHeadliner: true,
                  sortOrder: index,
                })),
              }
            : undefined,
        attendees: {
          create: {
            userId,
            cost:
              input.cost !== undefined ? input.cost : currentAttendance.cost,
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
      const userAttendance = result.attendees![0]
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
      where: { id: result.attendees![0].id },
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
      return await transformConcert(finalConcert, finalConcert.attendees![0])
    }
  }

  return await transformConcert(result, result.attendees![0])
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

  // Fork on shared headliner *set* change (co-headliners), not only the primary id
  const existingHeadlinerIds = getHeadlinerIdsFromConcertBands(
    existing.bands.map((b) => ({
      bandId: b.bandId,
      isHeadliner: b.isHeadliner,
    }))
  )
  const inputHeadlinerIds = input.bandIds
    ? getHeadlinerBandIdsInOrder(
        input.bandIds.map((b) => ({
          bandId: b.bandId,
          isHeadliner: b.isHeadliner || false,
        }))
      )
    : undefined
  const headlinerChanged =
    input.bandIds !== undefined &&
    !headlinerSetsEqual(inputHeadlinerIds!, existingHeadlinerIds)

  const existingHeadlinerOrder = [...existing.bands]
    .filter((b) => b.isHeadliner)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => b.bandId)
  const headlinerOrderChanged =
    input.bandIds !== undefined &&
    headlinerSetsEqual(inputHeadlinerIds!, existingHeadlinerIds) &&
    !headlinerOrdersEqual(inputHeadlinerIds!, existingHeadlinerOrder)

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

  // Same co-headliner set but different order → rewrite shared ConcertBand.sortOrder (no fork).
  // Wrap in transaction to keep the reorder atomic.
  if (input.bandIds && headlinerOrderChanged) {
    const newHeadliners = input.bandIds.filter((b) => b.isHeadliner)
    const newSupportingActs: SupportingActItem[] = input.bandIds
      .filter((b) => !b.isHeadliner)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))

    await prisma.$transaction(async (tx) => {
      await tx.userConcert.update({
        where: { id: attendance.id },
        data: { supportingActIds: newSupportingActs },
      })

      await tx.concertBand.deleteMany({
        where: { concertId: id },
      })

      if (newHeadliners.length > 0) {
        await tx.concertBand.createMany({
          data: newHeadliners.map((b, index) => ({
            concertId: id,
            bandId: b.bandId,
            isHeadliner: true,
            sortOrder: index,
          })),
        })
      }
    })

    input = { ...input, bandIds: undefined }
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
    input.bandIds !== undefined &&
    !headlinerChanged &&
    !headlinerOrderChanged &&
    noCoreFieldChanged
  if (onlyBandsChanged) {
    const supportActOverrides: SupportingActItem[] = input
      .bandIds!.filter((b) => !b.isHeadliner)
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
    const supportActOverrides: SupportingActItem[] = input.bandIds
      .filter((b) => !b.isHeadliner)
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

  // If updating bands (single-attendee concert), all co-headliners go in ConcertBand
  if (input.bandIds) {
    const newHeadliners = input.bandIds.filter((b) => b.isHeadliner)
    const newSupportingActs: SupportingActItem[] = input.bandIds
      .filter((b) => !b.isHeadliner)
      .map((b, index) => ({ bandId: b.bandId, sortOrder: index }))

    await prisma.userConcert.update({
      where: { id: attendance.id },
      data: { supportingActIds: newSupportingActs },
    })

    await prisma.concertBand.deleteMany({
      where: { concertId: id },
    })
    if (newHeadliners.length > 0) {
      await prisma.concertBand.createMany({
        data: newHeadliners.map((b, index) => ({
          concertId: id,
          bandId: b.bandId,
          isHeadliner: true,
          sortOrder: index,
        })),
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
      include: {
        bands: {
          select: { bandId: true, isHeadliner: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (updatedConcert) {
      const updatedHeadliner = getHeadliner(
        updatedConcert.bands.map((b) => ({
          bandId: b.bandId,
          isHeadliner: b.isHeadliner,
        }))
      )
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
                supportingActIds:
                  currentAttendance.supportingActIds ?? undefined,
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
            return await transformConcert(
              finalConcert,
              finalConcert.attendees![0]
            )
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

  return await transformConcert(concert, concert.attendees![0])
}
