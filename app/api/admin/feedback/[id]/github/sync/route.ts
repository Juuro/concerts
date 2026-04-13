import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { syncAppFeedbackGithubState } from "@/lib/github/sync-app-feedback-github"
import { prisma } from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const result = await syncAppFeedbackGithubState(id, {
      actorUserId: session.user.id,
    })
    const feedback = await prisma.appFeedback.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        owner: { select: { id: true, email: true, name: true } },
      },
    })

    return NextResponse.json({
      ...result,
      feedback,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Feedback not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (
      error instanceof Error &&
      error.message === "No GitHub issue linked to this feedback"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    Sentry.captureException(error)
    console.error(
      "[feedback-github-sync] Failed to sync GitHub issue state:",
      error
    )
    return NextResponse.json(
      { error: "Failed to sync GitHub issue state" },
      { status: 500 }
    )
  }
}
