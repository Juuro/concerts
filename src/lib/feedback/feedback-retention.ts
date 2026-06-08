import { prisma } from "@/lib/prisma"

/**
 * Parses FEEDBACK_RETENTION_DAYS. Returns null if unset or not a positive integer.
 */
export function parseFeedbackRetentionDays(): number | null {
  const raw = process.env.FEEDBACK_RETENTION_DAYS?.trim()
  if (!raw) return null
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * Permanently deletes closed feedback (DONE or DISCARDED) older than the retention window (by createdAt).
 */
export async function purgeExpiredAppFeedback(
  retentionDays: number
): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await prisma.appFeedback.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      triageStatus: { in: ["DONE", "DISCARDED"] },
    },
  })
  return { deleted: result.count }
}
