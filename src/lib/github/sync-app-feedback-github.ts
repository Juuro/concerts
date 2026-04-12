import type { GithubIssueState } from "@/generated/prisma/client"
import { fetchGithubIssueStateByNumber } from "@/lib/github/fetch-github-issue-state"
import { prisma } from "@/lib/prisma"

function envAutoDoneOnGithubClose(): boolean {
  const v = process.env.FEEDBACK_GITHUB_CLOSE_SETS_DONE?.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}

async function resolveActorUserId(explicit?: string): Promise<string> {
  if (explicit) return explicit
  const admin = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!admin) {
    throw new Error("No admin user available for audit log")
  }
  return admin.id
}

export interface SyncAppFeedbackGithubResult {
  id: string
  githubIssueState: GithubIssueState
  githubSyncedAt: Date
  triageStatus: string
  autoDoneApplied: boolean
}

/**
 * Pulls issue state from GitHub and updates `AppFeedback`.
 * Optionally sets triage to DONE when GitHub reports closed (env flag).
 */
export async function syncAppFeedbackGithubState(
  feedbackId: string,
  options: { actorUserId?: string } = {}
): Promise<SyncAppFeedbackGithubResult> {
  const row = await prisma.appFeedback.findUnique({
    where: { id: feedbackId },
  })
  if (!row) {
    throw new Error("Feedback not found")
  }
  if (row.githubIssueNumber == null) {
    throw new Error("No GitHub issue linked to this feedback")
  }

  const { state } = await fetchGithubIssueStateByNumber(row.githubIssueNumber)
  const prismaState: GithubIssueState = state === "CLOSED" ? "CLOSED" : "OPEN"
  const syncedAt = new Date()

  const autoDone =
    prismaState === "CLOSED" &&
    envAutoDoneOnGithubClose() &&
    row.triageStatus !== "DONE" &&
    row.triageStatus !== "DISCARDED"

  const updated = await prisma.appFeedback.update({
    where: { id: feedbackId },
    data: {
      githubIssueState: prismaState,
      githubSyncedAt: syncedAt,
      ...(autoDone
        ? {
            triageStatus: "DONE" as const,
            closedAt: new Date(),
          }
        : {}),
    },
  })

  const actorId = await resolveActorUserId(options.actorUserId)

  await prisma.adminActivity.create({
    data: {
      userId: actorId,
      action: "feedback_github_sync",
      targetType: "feedback",
      targetId: feedbackId,
      details: {
        githubIssueNumber: row.githubIssueNumber,
        githubIssueState: prismaState,
        autoDoneApplied: autoDone,
      },
    },
  })

  return {
    id: updated.id,
    githubIssueState: updated.githubIssueState!,
    githubSyncedAt: updated.githubSyncedAt!,
    triageStatus: updated.triageStatus,
    autoDoneApplied: autoDone,
  }
}
