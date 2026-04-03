import { prisma } from "../prisma"
import { Prisma } from "@/generated/prisma/client"
import { getStartOfToday } from "./date"

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
          ? Prisma.sql`AND c."date" >= ${new Date(Date.UTC(filters.year, 0, 1, 0, 0, 0, 0))} AND c."date" <= ${new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999))}`
          : Prisma.empty
      const cityClause =
        filters.city != null
          ? Prisma.sql`AND c."normalizedCity" = ${filters.city}`
          : Prisma.empty
      const pastClause = filters.pastOnly
        ? Prisma.sql`AND c."date" < ${now}`
        : Prisma.empty

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
  const concertWhere: Prisma.ConcertWhereInput = {}
  if (filters?.city) {
    concertWhere.normalizedCity = filters.city
  }
  const dateFilter: Prisma.DateTimeFilter = {}
  if (filters?.year) {
    const yearStart = new Date(Date.UTC(filters.year, 0, 1, 0, 0, 0, 0))
    const yearEnd = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999))
    dateFilter.gte = yearStart
    dateFilter.lte = yearEnd
  }
  if (filters?.pastOnly) {
    dateFilter.lt = now
  }
  if (Object.keys(dateFilter).length > 0) {
    concertWhere.date = dateFilter
  }

  const where: Prisma.UserConcertWhereInput = {
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

export async function getUserTotalSpentCached(
  userId: string
): Promise<{ total: number; currency: string }> {
  return getUserTotalSpent(userId, { pastOnly: true })
}
