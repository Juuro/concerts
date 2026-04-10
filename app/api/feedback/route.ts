import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { feedbackBodySchema } from "@/lib/feedback/schema"
import { prisma } from "@/lib/prisma"

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_SUBMISSIONS = 12
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const RATE_LIMIT_MAX_ENTRIES = 5000

let lastCleanupAt = Date.now()

function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(ip)
    }
  }
  lastCleanupAt = now
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()

  if (now - lastCleanupAt > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    cleanupExpiredEntries()
  }

  if (rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES && !rateLimitMap.has(ip)) {
    cleanupExpiredEntries()
    if (rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES) {
      return true
    }
  }

  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return false
  }

  entry.count++
  return true
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"
  )
}

function truncateUa(ua: string | null): string | undefined {
  if (!ua) return undefined
  const t = ua.trim()
  if (!t) return undefined
  return t.length > 512 ? t.slice(0, 512) : t
}

/**
 * POST /api/feedback — store product feedback (bugs, features, general).
 * Auth optional; rate-limited per IP. No third-party scripts.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": "900" },
      }
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = feedbackBodySchema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg =
      first.category?.[0] ||
      first.message?.[0] ||
      first.pagePath?.[0] ||
      "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { category, message, pagePath } = parsed.data

  let userId: string | null = null
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    userId = session?.user?.id ?? null
  } catch {
    userId = null
  }

  const userAgent = truncateUa(request.headers.get("user-agent"))

  try {
    await prisma.appFeedback.create({
      data: {
        category,
        message,
        userId,
        pagePath: pagePath ?? null,
        userAgent: userAgent ?? null,
      },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Feedback create error:", error)
    return NextResponse.json(
      { error: "Could not save feedback. Please try again." },
      { status: 500 }
    )
  }
}
