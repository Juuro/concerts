import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        banned: true,
        accounts: {
          select: { providerId: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "User is already verified" },
        { status: 400 }
      )
    }

    if (user.banned) {
      return NextResponse.json(
        { error: "Cannot resend verification for banned users" },
        { status: 400 }
      )
    }

    const hasCredential = user.accounts.some(
      (account) => account.providerId === "credential"
    )

    if (!hasCredential) {
      return NextResponse.json(
        { error: "User does not have email/password authentication" },
        { status: 400 }
      )
    }

    await auth.api.sendVerificationEmail({
      body: {
        email: user.email,
        callbackURL: "/",
      },
    })

    await prisma.adminActivity.create({
      data: {
        userId: session.user.id,
        action: "user_resend_verification",
        targetType: "user",
        targetId: id,
        details: {
          userName: user.name || user.email,
          email: user.email,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error resending verification email:", error)
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 }
    )
  }
}
