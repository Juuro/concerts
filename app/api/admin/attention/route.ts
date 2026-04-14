import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { getAttentionStats } from "@/lib/admin"

export async function GET() {
  const session = await getSession(await headers())

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stats = await getAttentionStats()
  return NextResponse.json(stats)
}
