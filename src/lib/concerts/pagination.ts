import { prisma } from "../prisma"
import { Prisma } from "@/generated/prisma/client"
import type { ConcertFilters, PaginatedConcerts } from "./types"
import { transformConcertsBatch } from "./transform"

/** Concert-side AND clauses for user attendance lists (no cursor). */
function userListConcertAndParts(
  filters: ConcertFilters
): Prisma.ConcertWhereInput[] {
  const parts: Prisma.ConcertWhereInput[] = []
  if (filters.bandSlug) {
    parts.push({
      bands: { some: { band: { slug: filters.bandSlug } } },
    })
  }
  if (filters.year != null) {
    parts.push({
      date: {
        gte: new Date(filters.year, 0, 1),
        lte: new Date(filters.year, 11, 31, 23, 59, 59, 999),
      },
    })
  }
  if (filters.city) {
    parts.push({ normalizedCity: filters.city })
  }
  return parts
}

function buildUserListWhere(filters: ConcertFilters): Prisma.UserConcertWhereInput {
  const parts = userListConcertAndParts(filters)
  const where: Prisma.UserConcertWhereInput = {
    userId: filters.userId!,
    ...(parts.length > 0 && { concert: { AND: parts } }),
  }
  if (filters.isPublic !== undefined) {
    where.user = { isPublic: filters.isPublic }
  }
  return where
}

function getUserConcertListInclude(): Prisma.UserConcertInclude {
  return {
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
  }
}

/** True if this user has another attended concert strictly newer than the given row (same filters). */
async function userHasNewerConcertsThan(
  filters: ConcertFilters,
  firstConcertDate: Date,
  firstConcertId: string
): Promise<boolean> {
  const parts = userListConcertAndParts(filters)
  const newer: Prisma.ConcertWhereInput = {
    OR: [
      { date: { gt: firstConcertDate } },
      { AND: [{ date: firstConcertDate }, { id: { gt: firstConcertId } }] },
    ],
  }
  const where: Prisma.UserConcertWhereInput = {
    userId: filters.userId!,
    concert: { AND: [...parts, newer] },
  }
  if (filters.isPublic !== undefined) {
    where.user = { isPublic: filters.isPublic }
  }
  const found = await prisma.userConcert.findFirst({
    where,
    select: { id: true },
  })
  return found != null
}

async function userHasNewerConcertsThanByBand(
  filters: ConcertFilters,
  bandId: string,
  firstConcertDate: Date,
  firstConcertId: string
): Promise<boolean> {
  const yearClause =
    filters.year != null
      ? Prisma.sql`AND c."date" >= ${new Date(filters.year, 0, 1)} AND c."date" <= ${new Date(filters.year, 11, 31, 23, 59, 59, 999)}`
      : Prisma.empty
  const cityClause =
    filters.city != null
      ? Prisma.sql`AND c."normalizedCity" = ${filters.city}`
      : Prisma.empty
  const userJoin =
    filters.isPublic !== undefined
      ? Prisma.sql`INNER JOIN "user" u ON u.id = uc."userId"`
      : Prisma.empty
  const userPublicClause =
    filters.isPublic !== undefined
      ? Prisma.sql`AND u."isPublic" = ${filters.isPublic}`
      : Prisma.empty

  const rows = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1
      FROM user_concert uc
      INNER JOIN concert c ON c.id = uc."concertId"
      ${userJoin}
      WHERE uc."userId" = ${filters.userId}
      ${userPublicClause}
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
        AND (c."date" > ${firstConcertDate}
          OR (c."date" = ${firstConcertDate} AND c.id > ${firstConcertId}))
    ) AS "exists"
  `
  return Boolean(rows?.[0]?.exists)
}

async function nonUserHasNewerConcertsThan(
  baseWhere: Prisma.ConcertWhereInput,
  firstConcertDate: Date,
  firstConcertId: string
): Promise<boolean> {
  const found = await prisma.concert.findFirst({
    where: {
      AND: [
        baseWhere,
        {
          OR: [
            { date: { gt: firstConcertDate } },
            { AND: [{ date: firstConcertDate }, { id: { gt: firstConcertId } }] },
          ],
        },
      ],
    },
    select: { id: true },
  })
  return found != null
}

/**
 * URL and API cursors are always concert ids (matches TransformedConcert.id).
 * Resolves to the UserConcert row id for Prisma cursor pagination.
 * Accepts legacy user_concert.id cursors for old bookmarks.
 */
async function resolveUserConcertCursorId(
  userId: string,
  cursor: string | undefined
): Promise<string | undefined> {
  if (!cursor) return undefined
  const uc = await prisma.userConcert.findFirst({
    where: {
      userId,
      OR: [{ concertId: cursor }, { id: cursor }],
    },
    select: { id: true },
  })
  return uc?.id
}

/** Newest first — matches forward pages and `ConcertListInfinite` prepend order. */
function sortConcertsByDateDescThenId<T extends { date: Date; id: string }>(
  items: T[]
): void {
  items.sort((a, b) => {
    const d = b.date.getTime() - a.date.getTime()
    if (d !== 0) return d
    return b.id.localeCompare(a.id)
  })
}

function sortUserConcertsByConcertDesc(
  items: { concert: { date: Date; id: string } }[]
): void {
  items.sort((a, b) => {
    const d = b.concert.date.getTime() - a.concert.date.getTime()
    if (d !== 0) return d
    return b.concert.id.localeCompare(a.concert.id)
  })
}

/**
 * Prisma backward + slice can still include the anchor row; prepending would
 * duplicate `concert.id` keys. `cursor` may be `concert.id` or legacy `user_concert.id`.
 */
function excludeAnchorFromBackwardUserConcerts<
  T extends { id: string; concert: { id: string } },
>(items: T[], cursor: string | undefined): T[] {
  if (!cursor) return items
  return items.filter((row) => row.concert.id !== cursor && row.id !== cursor)
}

function excludeAnchorConcertFromBackwardPlain<
  T extends { id: string },
>(items: T[], anchorConcertId: string | undefined): T[] {
  if (!anchorConcertId) return items
  return items.filter((row) => row.id !== anchorConcertId)
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
  let items = hasExtra
    ? direction === "forward"
      ? concerts.slice(0, -1)
      : concerts.slice(1)
    : concerts

  if (direction === "backward") {
    items = excludeAnchorConcertFromBackwardPlain(items, cursor)
    sortConcertsByDateDescThenId(items)
  }

  if (direction === "forward" && cursor && items.length === 0) {
    const anchor = await prisma.concert.findFirst({
      where: { ...where, id: cursor },
      include: {
        bands: {
          include: { band: true },
          orderBy: { sortOrder: "asc" },
        },
        festival: true,
        _count: { select: { attendees: true } },
      },
    })
    if (anchor) {
      items = [anchor]
    }
  }

  const hasPrevious =
    direction === "backward"
      ? hasExtra
      : items.length > 0
        ? await nonUserHasNewerConcertsThan(where, items[0].date, items[0].id)
        : false

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
    hasPrevious,
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

  // Keyset on (concert.date, concert.id) — same semantics as non-user pagination
  let cursorDate: Date | null = null
  let cursorConcertId: string | null = null
  let resolvedCursorUcId: string | null = null
  if (cursor) {
    const uc = await prisma.userConcert.findFirst({
      where: {
        userId: filters.userId!,
        OR: [{ concertId: cursor }, { id: cursor }],
      },
      select: {
        id: true,
        concert: { select: { date: true, id: true } },
      },
    })
    resolvedCursorUcId = uc?.id ?? null
    cursorDate = uc?.concert?.date ?? null
    cursorConcertId = uc?.concert?.id ?? null
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
    cursor && cursorDate && cursorConcertId
      ? isForward
        ? Prisma.sql`AND (c."date", c.id) < (${cursorDate}, ${cursorConcertId})`
        : Prisma.sql`AND (c."date", c.id) > (${cursorDate}, ${cursorConcertId})`
      : Prisma.empty
  const orderClause = isForward
    ? Prisma.sql`ORDER BY c."date" DESC, c.id DESC`
    : Prisma.sql`ORDER BY c."date" ASC, c.id ASC`

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
    if (
      direction === "forward" &&
      resolvedCursorUcId &&
      cursorDate &&
      cursorConcertId
    ) {
      const anchor = await prisma.userConcert.findFirst({
        where: { id: resolvedCursorUcId, userId: filters.userId! },
        include: getUserConcertListInclude(),
      })
      if (anchor) {
        const hasPrevious = await userHasNewerConcertsThanByBand(
          filters,
          bandId,
          anchor.concert.date,
          anchor.concert.id
        )
        return {
          items: await transformConcertsBatch([
            { concert: anchor.concert, attendance: anchor },
          ] as unknown as Parameters<typeof transformConcertsBatch>[0]),
          nextCursor: null,
          prevCursor: anchor.concert.id,
          hasMore: false,
          hasPrevious,
        }
      }
    }
    const hasPreviousEmpty =
      cursorDate != null && cursorConcertId != null
        ? await userHasNewerConcertsThanByBand(
            filters,
            bandId,
            cursorDate,
            cursorConcertId
          )
        : false
    return {
      items: [],
      nextCursor: null,
      prevCursor: cursorConcertId ?? cursor ?? null,
      hasMore: false,
      hasPrevious: hasPreviousEmpty,
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
  let items = hasExtra ? userConcerts.slice(0, limit) : userConcerts

  if (direction === "backward") {
    items.reverse()
    items = excludeAnchorFromBackwardUserConcerts(
      items,
      cursorConcertId ?? cursor ?? undefined
    )
    sortUserConcertsByConcertDesc(items)
  }

  return {
    items: await transformConcertsBatch(
      items.map((uc) => ({ concert: uc.concert, attendance: uc }))
    ),
    nextCursor:
      direction === "forward"
        ? hasExtra
          ? items[items.length - 1].concert.id
          : null
        : cursor
          ? (items[items.length - 1]?.concert.id ?? null)
          : null,
    prevCursor:
      direction === "forward"
        ? cursor
          ? (items[0]?.concert.id ?? null)
          : null
        : hasExtra
          ? (items[0]?.concert.id ?? null)
          : null,
    hasMore: direction === "forward" ? hasExtra : Boolean(cursor),
    hasPrevious:
      direction === "backward"
        ? hasExtra
        : items.length > 0
          ? await userHasNewerConcertsThanByBand(
              filters,
              bandId,
              items[0].concert.date,
              items[0].concert.id
            )
          : false,
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

  const resolvedCursorId = await resolveUserConcertCursorId(
    filters.userId!,
    cursor
  )

  const where = buildUserListWhere(filters)

  // Query UserConcert to get user's attended concerts
  const userConcerts = await prisma.userConcert.findMany({
    take,
    ...(resolvedCursorId && {
      cursor: { id: resolvedCursorId },
      skip: 1,
    }),
    where,
    include: getUserConcertListInclude(),
    orderBy: [{ concert: { date: "desc" } }, { concert: { id: "desc" } }],
  })

  // For backward direction, reverse to maintain consistent order
  if (direction === "backward") {
    userConcerts.reverse()
  }

  const hasExtra = userConcerts.length > limit
  let items = hasExtra
    ? direction === "forward"
      ? userConcerts.slice(0, -1)
      : userConcerts.slice(1)
    : userConcerts

  // Forward at global "oldest" tail: no rows strictly older than cursor — show anchor row
  if (
    direction === "forward" &&
    cursor &&
    resolvedCursorId &&
    items.length === 0
  ) {
    const anchor = await prisma.userConcert.findFirst({
      where: { ...buildUserListWhere(filters), id: resolvedCursorId },
      include: getUserConcertListInclude(),
    })
    if (anchor) {
      items = [anchor]
    }
  }

  if (direction === "backward") {
    items = excludeAnchorFromBackwardUserConcerts(items, cursor ?? undefined)
    sortUserConcertsByConcertDesc(items)
  }

  return {
    items: await transformConcertsBatch(
      items.map((uc) => ({
        concert: uc.concert,
        attendance: uc,
      })) as unknown as Parameters<typeof transformConcertsBatch>[0]
    ),
    nextCursor:
      direction === "forward" && hasExtra
        ? items[items.length - 1].concert.id
        : direction === "backward"
          ? (items[items.length - 1]?.concert.id ?? null)
          : null,
    prevCursor:
      direction === "backward" && hasExtra
        ? items[0]?.concert.id ?? null
        : direction === "forward" && cursor
          ? (items[0]?.concert.id ?? null)
          : null,
    hasMore: direction === "forward" ? hasExtra : true,
    hasPrevious:
      direction === "backward"
        ? hasExtra
        : items.length > 0
          ? await userHasNewerConcertsThan(
              filters,
              items[0].concert.date,
              items[0].concert.id
            )
          : false,
  }
}
