import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import {
  deriveAuthProviderLabel,
  deriveUserAccountStatus,
} from "@/lib/user-account-status"
import { Prisma } from "@/generated/prisma/client"

const VALID_FILTERS = [
  "all",
  "active",
  "banned",
  "unverified",
  "reset_pending",
] as const

type UserFilter = (typeof VALID_FILTERS)[number]

type PendingResetFilter = Extract<
  UserFilter,
  "active" | "unverified" | "reset_pending"
>

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  image: true,
  role: true,
  banned: true,
  banReason: true,
  banExpires: true,
  emailVerified: true,
  createdAt: true,
  accounts: {
    select: { providerId: true },
  },
  _count: {
    select: { attendedConcerts: true },
  },
} as const

type UserSelectResult = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>

function pendingPasswordResetExists(now: Date): Prisma.Sql {
  return Prisma.sql`
    EXISTS (
      SELECT 1 FROM verification v
      WHERE v.value = u.id
        AND v.identifier LIKE 'reset-password:%'
        AND v."expiresAt" > ${now}
    )
  `
}

function buildPendingResetFilterWhereSql(
  filter: PendingResetFilter,
  now: Date
): Prisma.Sql {
  const pendingExists = pendingPasswordResetExists(now)

  switch (filter) {
    case "active":
      return Prisma.sql`u.banned = false AND u."emailVerified" = true AND NOT (${pendingExists})`
    case "unverified":
      return Prisma.sql`u.banned = false AND u."emailVerified" = false AND NOT (${pendingExists})`
    case "reset_pending":
      return Prisma.sql`u.banned = false AND (${pendingExists})`
  }
}

async function getPendingPasswordResetExpiresForUsers(
  userIds: string[]
): Promise<Map<string, Date>> {
  if (userIds.length === 0) {
    return new Map()
  }

  const now = new Date()
  const pendingResets = await prisma.verification.findMany({
    where: {
      value: { in: userIds },
      identifier: { startsWith: "reset-password:" },
      expiresAt: { gt: now },
    },
    select: { value: true, expiresAt: true },
  })

  const expiresByUserId = new Map<string, Date>()
  for (const reset of pendingResets) {
    const existing = expiresByUserId.get(reset.value)
    if (!existing || reset.expiresAt > existing) {
      expiresByUserId.set(reset.value, reset.expiresAt)
    }
  }

  return expiresByUserId
}

async function fetchUsersByPendingResetFilter(
  filter: PendingResetFilter,
  limit: number,
  offset: number
): Promise<{ users: UserSelectResult[]; total: number }> {
  const now = new Date()
  const whereSql = buildPendingResetFilterWhereSql(filter, now)

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT u.id
      FROM "user" u
      WHERE ${whereSql}
      ORDER BY u."createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "user" u
      WHERE ${whereSql}
    `,
  ])

  const ids = idRows.map((row) => row.id)
  const total = Number(countRows[0]?.count ?? 0)

  if (ids.length === 0) {
    return { users: [], total }
  }

  const usersById = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: USER_SELECT,
  })
  const userMap = new Map(usersById.map((user) => [user.id, user]))
  const users = ids
    .map((id) => userMap.get(id))
    .filter((user): user is UserSelectResult => user !== undefined)

  return { users, total }
}

async function fetchUsersSimple(
  filter: "all" | "banned",
  limit: number,
  offset: number
): Promise<{ users: UserSelectResult[]; total: number }> {
  const whereClause = filter === "banned" ? { banned: true } : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: USER_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where: whereClause }),
  ])

  return { users, total }
}

function mapUserToResponse(
  user: UserSelectResult,
  expiresByUserId: Map<string, Date>
) {
  const passwordResetExpiresAt = expiresByUserId.get(user.id)
  const hasPendingPasswordReset = passwordResetExpiresAt !== undefined
  const authProviderLabel = deriveAuthProviderLabel(
    user.accounts.map((account) => account.providerId)
  )

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    image: user.image,
    role: user.role,
    banned: user.banned,
    banReason: user.banReason,
    banExpires: user.banExpires,
    emailVerified: user.emailVerified,
    accountStatus: deriveUserAccountStatus({
      banned: user.banned,
      emailVerified: user.emailVerified,
      hasPendingPasswordReset,
    }),
    authProviderLabel,
    passwordResetExpiresAt: passwordResetExpiresAt?.toISOString(),
    createdAt: user.createdAt,
    concertCount: user._count.attendedConcerts,
  }
}

function isPendingResetFilter(
  filter: UserFilter
): filter is PendingResetFilter {
  return (
    filter === "active" || filter === "unverified" || filter === "reset_pending"
  )
}

function needsPendingResetExpiryLookup(filter: UserFilter): boolean {
  return filter === "all" || filter === "reset_pending"
}

export async function GET(request: NextRequest) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const filterParam = searchParams.get("filter") || "all"
  const filter = VALID_FILTERS.includes(filterParam as UserFilter)
    ? (filterParam as UserFilter)
    : "all"
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    const { users, total } = isPendingResetFilter(filter)
      ? await fetchUsersByPendingResetFilter(filter, limit, offset)
      : await fetchUsersSimple(filter, limit, offset)

    const expiresByUserId = needsPendingResetExpiryLookup(filter)
      ? await getPendingPasswordResetExpiresForUsers(
          users.map((user) => user.id)
        )
      : new Map<string, Date>()

    return NextResponse.json({
      users: users.map((user) => mapUserToResponse(user, expiresByUserId)),
      total,
      limit,
      offset,
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}
