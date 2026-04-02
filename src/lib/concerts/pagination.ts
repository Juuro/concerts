import { prisma } from "../prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ConcertFilters, PaginatedConcerts } from "./types"
import { transformConcertsBatch } from "./transform"

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
    const uc = await prisma.userConcert.findFirst({
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
          ? (items[items.length - 1]?.id ?? null)
          : null,
    prevCursor:
      direction === "forward"
        ? cursor
          ? (items[0]?.id ?? null)
          : null
        : hasExtra
          ? (items[0]?.id ?? null)
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
