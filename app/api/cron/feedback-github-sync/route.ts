import { NextRequest, NextResponse } from "next/server"
import { batchSyncStaleFeedbackGithub } from "@/lib/github/batch-sync-feedback-github"

/**
 * Hourly (or on-demand) sync of GitHub issue open/closed state for linked feedback.
 * Protect with CRON_SECRET: `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    )
  }

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await batchSyncStaleFeedbackGithub()
  return NextResponse.json({ ok: true, ...result })
}
