import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import {
  parseFeedbackRetentionDays,
  purgeExpiredAppFeedback,
} from "@/lib/feedback/feedback-retention"

/**
 * Deletes DONE/DISCARDED AppFeedback rows older than FEEDBACK_RETENTION_DAYS (by createdAt).
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
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

  const days = parseFeedbackRetentionDays()
  if (days == null) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "FEEDBACK_RETENTION_DAYS not set or invalid",
    })
  }

  try {
    const { deleted } = await purgeExpiredAppFeedback(days)
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { ok: false, error: "Feedback retention cleanup failed" },
      { status: 500 }
    )
  }
}
