import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

/**
 * Auto-unban all users whose ban has expired.
 * Called when admin dashboard loads.
 */
export async function POST() {
  const session = await getSession(await headers())

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()

    // Find and unban all users with expired bans
    const result = await prisma.user.updateMany({
      where: {
        banned: true,
        banExpires: {
          lt: now,
        },
      },
      data: {
        banned: false,
        banReason: null,
        banExpires: null,
      },
    })

    return NextResponse.json({
      unbannedCount: result.count,
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error cleaning up expired bans:", error)
    return NextResponse.json(
      { error: "Failed to cleanup expired bans" },
      { status: 500 }
    )
  }
}
