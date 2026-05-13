import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getSubscriptionSummary } from "@/lib/paddle/entitlement"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await getSubscriptionSummary(session.user.id)
  if (!summary) {
    return NextResponse.json({ subscription: null })
  }

  return NextResponse.json({ subscription: summary })
}
