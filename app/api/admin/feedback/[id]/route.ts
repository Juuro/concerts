import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { feedbackTriagePatchSchema } from "@/lib/feedback/triage-schema"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const feedback = await prisma.appFeedback.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        owner: { select: { id: true, email: true, name: true } },
      },
    })

    if (!feedback) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const owners = await prisma.user.findMany({
      where: { role: "admin" },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ feedback, owners })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { error: "Failed to fetch feedback detail" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = feedbackTriagePatchSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const existing = await prisma.appFeedback.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const nextStatus = parsed.data.triageStatus ?? existing.triageStatus
    const shouldSetTriagedAt =
      !existing.triagedAt && nextStatus !== "NEW" && nextStatus !== "DISCARDED"
    const shouldSetClosedAt =
      nextStatus === "DONE" || nextStatus === "DISCARDED"

    const updated = await prisma.appFeedback.update({
      where: { id },
      data: {
        ...parsed.data,
        triagedAt: shouldSetTriagedAt ? new Date() : existing.triagedAt,
        closedAt: shouldSetClosedAt ? new Date() : null,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        owner: { select: { id: true, email: true, name: true } },
      },
    })

    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "feedback_triage_update",
        targetType: "feedback",
        targetId: id,
        details: {
          fromStatus: existing.triageStatus,
          toStatus: updated.triageStatus,
          priority: updated.priority,
          ownerUserId: updated.ownerUserId,
        },
      },
    })

    return NextResponse.json({ feedback: updated })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { error: "Failed to update feedback" },
      { status: 500 }
    )
  }
}
