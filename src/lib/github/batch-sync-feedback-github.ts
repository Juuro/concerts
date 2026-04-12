import { prisma } from "@/lib/prisma"
import { syncAppFeedbackGithubState } from "@/lib/github/sync-app-feedback-github"

const DEFAULT_MAX_ITEMS = 20
const DEFAULT_STALE_HOURS = 6

/**
 * Syncs GitHub issue state for linked feedback rows that have not been synced recently.
 * Used by the cron route; tolerates per-row failures.
 */
export async function batchSyncStaleFeedbackGithub(options?: {
  maxItems?: number
  staleHours?: number
}): Promise<{ processed: number; errors: number }> {
  const maxItems = options?.maxItems ?? DEFAULT_MAX_ITEMS
  const staleHours = options?.staleHours ?? DEFAULT_STALE_HOURS
  const threshold = new Date(Date.now() - staleHours * 60 * 60 * 1000)

  const rows = await prisma.appFeedback.findMany({
    where: {
      githubIssueNumber: { not: null },
      OR: [{ githubSyncedAt: null }, { githubSyncedAt: { lt: threshold } }],
    },
    select: { id: true },
    orderBy: [{ githubSyncedAt: "asc" }, { updatedAt: "desc" }],
    take: maxItems,
  })

  // Resolve actor once for the whole batch to avoid a DB query per row
  const actorAdmin = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  const actorUserId = actorAdmin?.id

  let errors = 0
  for (const row of rows) {
    try {
      await syncAppFeedbackGithubState(row.id, { actorUserId })
    } catch (err) {
      errors++
      console.error(
        `[batch-sync-feedback] Failed to sync feedback ${row.id}:`,
        err
      )
    }
  }

  return { processed: rows.length, errors }
}
