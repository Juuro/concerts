import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { feedbackGithubCreateSchema } from "@/lib/feedback/triage-schema"
import { createFeedbackIssue } from "@/lib/github/feedback-issues"
import { linkIssueToProjectV2 } from "@/lib/github/project-v2"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = feedbackGithubCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const feedback = await prisma.appFeedback.findUnique({ where: { id } })
    if (!feedback) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (feedback.githubIssueNumber) {
      return NextResponse.json(
        {
          error: "Feedback already linked to a GitHub issue",
          githubIssueNumber: feedback.githubIssueNumber,
          githubIssueUrl: feedback.githubIssueUrl,
        },
        { status: 409 }
      )
    }

    const {
      title,
      body: issueBody,
      labels,
      includeOriginalMessage,
    } = parsed.data

    const created = await createFeedbackIssue({
      feedbackId: feedback.id,
      category: feedback.category,
      pagePath: feedback.pagePath,
      title,
      labels,
      includeOriginalMessage,
      body: includeOriginalMessage
        ? `${issueBody}\n\n---\nOriginal feedback:\n${feedback.message}`
        : issueBody,
    })

    let githubProjectItemId: string | null = null
    let projectLinkError: string | undefined
    try {
      const linked = await linkIssueToProjectV2(created.nodeId)
      if (linked) {
        githubProjectItemId = linked.projectItemId
      }
    } catch (projectErr) {
      Sentry.captureException(projectErr)
      projectLinkError =
        projectErr instanceof Error ? projectErr.message : "Project link failed"
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedFeedback = await tx.appFeedback.update({
        where: { id },
        data: {
          githubIssueNumber: created.number,
          githubIssueUrl: created.url,
          githubProjectItemId: githubProjectItemId ?? undefined,
          githubIssueState: "OPEN",
          githubSyncedAt: new Date(),
          triageStatus:
            feedback.triageStatus === "NEW" ? "TRIAGED" : feedback.triageStatus,
          triagedAt: feedback.triagedAt ?? new Date(),
        },
      })

      await tx.adminActivity.create({
        data: {
          userId: session.user.id,
          action: "feedback_github_issue_created",
          targetType: "feedback",
          targetId: id,
          details: {
            githubIssueNumber: created.number,
            githubIssueUrl: created.url,
            ...(githubProjectItemId && { githubProjectItemId }),
            ...(projectLinkError && { projectLinkError }),
          },
        },
      })

      return updatedFeedback
    })

    return NextResponse.json({
      githubIssueNumber: created.number,
      githubIssueUrl: created.url,
      githubProjectItemId,
      ...(projectLinkError && { projectLinkError }),
      feedback: updated,
    })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { error: "Failed to create GitHub issue" },
      { status: 500 }
    )
  }
}
