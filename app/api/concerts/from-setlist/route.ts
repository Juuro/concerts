import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isFeatureEnabled, FEATURE_FLAGS } from "@/utils/featureFlags"
import { createRateLimiter, clientIpFrom } from "@/lib/rateLimit"
import {
  buildCreateInputFromSetlist,
  type BuildSetlistResultCode,
} from "@/lib/concerts/aiSearch"
import { createConcert } from "@/lib/concerts/mutations/create"
import { revalidateConcertCaches } from "@/lib/concerts/revalidate"
import { ConcertAlreadyExistsError } from "@/lib/concerts/errors"

export const dynamic = "force-dynamic"

// Backfill is bursty (clicking through decades); generous but bounded.
const userLimiter = createRateLimiter({ windowMs: 60_000, max: 20 })
const ipLimiter = createRateLimiter({ windowMs: 60_000, max: 40 })

// Setlist.fm setlist ids are short hex tokens. Constraining the format also
// prevents the value from becoming an SSRF vector in the upstream URL.
const bodySchema = z
  .object({
    setlistId: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{6,16}$/, "Invalid setlist id"),
  })
  .strict()

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** Format an ISO `yyyy-mm-dd` as `D Mon YYYY` without timezone drift. */
function humanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[m - 1] ?? ""} ${y}`
}

const ERROR_BY_CODE: Record<
  BuildSetlistResultCode,
  { status: number; message: string }
> = {
  NOT_FOUND: { status: 404, message: "Couldn't find that show on Setlist.fm." },
  INVALID_DATE: {
    status: 422,
    message: "This show has an invalid date — add it manually below.",
  },
  MISSING_COORDINATES: {
    status: 422,
    message: "This show has no location data — add it manually below.",
  },
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_CONCERT_AI_SEARCH, false)) {
    return NextResponse.json(
      { error: "Feature not available" },
      { status: 403 }
    )
  }

  if (
    !userLimiter.check(session.user.id) ||
    !ipLimiter.check(clientIpFrom(request.headers))
  ) {
    return NextResponse.json(
      { error: "Slow down a moment — too many adds. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    const built = await buildCreateInputFromSetlist(
      parsed.data.setlistId,
      session.user.id
    )

    if (!built.ok) {
      const mapped = ERROR_BY_CODE[built.code]
      return NextResponse.json(
        { error: mapped.message, code: built.code },
        { status: mapped.status }
      )
    }

    const concert = await createConcert(built.input)
    revalidateConcertCaches(session.user.id)

    return NextResponse.json(
      {
        concertId: concert.id,
        editPath: `/concerts/edit/${concert.id}`,
        summary: {
          headliner: built.meta.headliner,
          venue: built.meta.venue,
          date: built.meta.dateIso,
          toast: `Added ${built.meta.headliner} — ${built.meta.venue}, ${humanDate(built.meta.dateIso)}`,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ConcertAlreadyExistsError) {
      return NextResponse.json(
        {
          error: "This concert is already in your list.",
          concertId: error.concertId,
          editPath: `/concerts/edit/${error.concertId}`,
        },
        { status: 409 }
      )
    }
    Sentry.captureException(error)
    console.error("Add-from-setlist failed:", error)
    return NextResponse.json(
      { error: "Couldn't add that concert. Please try again." },
      { status: 500 }
    )
  }
}
