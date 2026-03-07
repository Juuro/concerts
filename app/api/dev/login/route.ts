import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomBytes, createHmac } from "crypto"

/**
 * Development-only endpoint to create an authenticated session.
 * Used by screenshot scripts to access protected pages locally.
 *
 * SECURITY: This endpoint only works when:
 * - NODE_ENV is "development"
 */
export async function POST() {
  // Strict environment check
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    )
  }

  const devUserEmail = process.env.DEV_USER_EMAIL
  const secret = process.env.BETTER_AUTH_SECRET

  if (!devUserEmail) {
    return NextResponse.json(
      { error: "DEV_USER_EMAIL environment variable is not set" },
      { status: 400 }
    )
  }

  if (!secret) {
    return NextResponse.json(
      { error: "BETTER_AUTH_SECRET environment variable is not set" },
      { status: 400 }
    )
  }

  try {
    // Find the dev user
    const user = await prisma.user.findUnique({
      where: { email: devUserEmail },
    })

    if (!user) {
      return NextResponse.json(
        { error: `User with email ${devUserEmail} not found` },
        { status: 404 }
      )
    }

    // Generate a session token
    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create session in database
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        userAgent: "Puppeteer Screenshot Script",
      },
    })

    // Sign the token using HMAC-SHA256 (same as Better Auth)
    const signature = createHmac("sha256", secret)
      .update(token)
      .digest("base64")

    // Cookie value format: token.signature
    const signedValue = `${token}.${signature}`

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })

    // Set the Better Auth session cookie with signed value
    response.cookies.set("better-auth.session_token", signedValue, {
      httpOnly: true,
      secure: false, // localhost is not HTTPS
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    })

    return response
  } catch (error) {
    console.error("Dev login error:", error)
    return NextResponse.json(
      { error: "Failed to create dev session" },
      { status: 500 }
    )
  }
}
