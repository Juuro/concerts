import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import {
  deriveAuthProviderLabel,
  deriveUserAccountStatus,
} from "@/lib/user-account-status"
import type { Prisma } from "@/generated/prisma/client"

const VALID_FILTERS = [
  "all",
  "active",
  "banned",
  "unverified",
  "reset_pending",
] as const

type UserFilter = (typeof VALID_FILTERS)[number]

async function getPendingPasswordResetUserIds(): Promise<{
  userIds: string[]
  expiresByUserId: Map<string, Date>
}> {
  const pendingResets = await prisma.verification.findMany({
    where: {
      identifier: { startsWith: "reset-password:" },
      expiresAt: { gt: new Date() },
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

  return {
    userIds: [...expiresByUserId.keys()],
    expiresByUserId,
  }
}

function buildWhereClause(
  filter: UserFilter,
  pendingResetUserIds: string[]
): Prisma.UserWhereInput {
  const excludePendingReset =
    pendingResetUserIds.length > 0 ? { id: { notIn: pendingResetUserIds } } : {}

  switch (filter) {
    case "banned":
      return { banned: true }
    case "active":
      return {
        banned: false,
        emailVerified: true,
        ...excludePendingReset,
      }
    case "unverified":
      return {
        banned: false,
        emailVerified: false,
        ...excludePendingReset,
      }
    case "reset_pending":
      if (pendingResetUserIds.length === 0) {
        return { id: { in: [] } }
      }
      return {
        banned: false,
        id: { in: pendingResetUserIds },
      }
    default:
      return {}
  }
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
    const { userIds: pendingResetUserIds, expiresByUserId } =
      filter === "banned"
        ? { userIds: [], expiresByUserId: new Map<string, Date>() }
        : await getPendingPasswordResetUserIds()
    const whereClause = buildWhereClause(filter, pendingResetUserIds)

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
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
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where: whereClause }),
    ])

    return NextResponse.json({
      users: users.map((user) => {
        const authProviders = user.accounts.map((account) => account.providerId)
        const passwordResetExpiresAt = expiresByUserId.get(user.id)
        const hasPendingPasswordReset = passwordResetExpiresAt !== undefined
        const accountStatus = deriveUserAccountStatus({
          banned: user.banned,
          emailVerified: user.emailVerified,
          hasPendingPasswordReset,
        })
        const authProviderLabel = deriveAuthProviderLabel(authProviders)

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
          accountStatus,
          authProviders,
          authProviderLabel,
          passwordResetExpiresAt: passwordResetExpiresAt?.toISOString(),
          createdAt: user.createdAt,
          concertCount: user._count.attendedConcerts,
        }
      }),
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
