import { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { checkUserBan } from "@/lib/ban"
import BannedClient from "./BannedClient"

export const metadata: Metadata = {
  title: "Account Suspended | My Concerts",
  description: "Your account has been suspended",
}

export default async function BannedPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  // If not logged in, redirect to login
  if (!session?.user) {
    redirect("/login")
  }

  // Check ban status
  const banStatus = await checkUserBan(session.user.id)

  // If not banned (or ban expired), redirect to home
  if (!banStatus.banned) {
    redirect("/")
  }

  return (
    <BannedClient
      reason={banStatus.reason || null}
      expiresAt={banStatus.expiresAt?.toISOString() || null}
    />
  )
}
