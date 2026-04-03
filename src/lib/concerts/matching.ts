import { type Concert as PrismaConcert } from "@/generated/prisma/client"
import { prisma } from "../prisma"

// Coordinate tolerance for matching concerts (~100m)
const COORD_TOLERANCE = 0.001

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
      latitude: {
        gte: latitude - COORD_TOLERANCE,
        lte: latitude + COORD_TOLERANCE,
      },
      longitude: {
        gte: longitude - COORD_TOLERANCE,
        lte: longitude + COORD_TOLERANCE,
      },
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

/**
 * Get the headliner band from a list of concert bands.
 */
export function getHeadliner(
  bands: { bandId: string; isHeadliner: boolean }[]
): { bandId: string; isHeadliner: boolean } | undefined {
  return bands.find((b) => b.isHeadliner)
}
