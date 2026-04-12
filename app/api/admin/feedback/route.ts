import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { Prisma } from "@/generated/prisma/client"
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
    queue: request.nextUrl.searchParams.get("queue") ?? undefined,
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

  const { queue, status, category, priority, q, limit, offset } = parsed.data

  const conditions: Prisma.AppFeedbackWhereInput[] = []

  if (status) {
    conditions.push({ triageStatus: status })
  }
  if (category) {
    conditions.push({ category })
  }
  if (priority) {
    conditions.push({ priority })
  }
  if (q) {
    conditions.push({
      OR: [
        { message: { contains: q, mode: "insensitive" } },
        { pagePath: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ],
    })
  }

  if (!status && queue === "active") {
    conditions.push({ triageStatus: { notIn: ["DONE", "DISCARDED"] } })
    conditions.push({
      OR: [
        { githubIssueNumber: null },
        { githubIssueState: null },
        { githubIssueState: { not: "CLOSED" } },
      ],
    })
  }

  const where: Prisma.AppFeedbackWhereInput =
    conditions.length === 0
      ? {}
      : conditions.length === 1
        ? conditions[0]!
        : { AND: conditions }

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
          githubIssueState: true,
          githubSyncedAt: true,
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
