import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { feedbackListQuerySchema } from "@/lib/feedback/triage-schema"

export async function GET(request: NextRequest) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = feedbackListQuerySchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    category: request.nextUrl.searchParams.get("category") ?? undefined,
    priority: request.nextUrl.searchParams.get("priority") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    offset: request.nextUrl.searchParams.get("offset") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 }
    )
  }

  const { status, category, priority, q, limit, offset } = parsed.data

  const where = {
    ...(status ? { triageStatus: status } : {}),
    ...(category ? { category } : {}),
    ...(priority ? { priority } : {}),
    ...(q
      ? {
          OR: [
            { message: { contains: q, mode: "insensitive" as const } },
            { pagePath: { contains: q, mode: "insensitive" as const } },
            { tags: { has: q } },
          ],
        }
      : {}),
  }

  try {
    const [items, total] = await Promise.all([
      prisma.appFeedback.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          category: true,
          triageStatus: true,
          priority: true,
          pagePath: true,
          tags: true,
          githubIssueNumber: true,
          githubIssueUrl: true,
          message: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
      }),
      prisma.appFeedback.count({ where }),
    ])

    return NextResponse.json({
      total,
      limit,
      offset,
      items: items.map((item) => ({
        ...item,
        messagePreview:
          item.message.length > 200
            ? `${item.message.slice(0, 200).trim()}...`
            : item.message,
      })),
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error fetching feedback queue", error)
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    )
  }
}
