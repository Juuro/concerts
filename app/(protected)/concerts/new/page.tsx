import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ConcertForm } from "@/components/ConcertForm"
import { ConcertMemoryAssistant } from "@/components/ConcertMemoryAssistant"
import { isFeatureEnabled, FEATURE_FLAGS } from "@/utils/featureFlags"
import "./new-concert.scss"

export const metadata = {
  title: "Add Concert | Concertivity",
  description: "Add a new concert to your collection",
}

export default async function NewConcertPage() {
  const session = await getSession(await headers())

  if (!session?.user) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true },
  })

  const aiSearchEnabled = isFeatureEnabled(
    FEATURE_FLAGS.ENABLE_CONCERT_AI_SEARCH,
    false
  )

  return (
    <div className="new-concert">
      <h1>Add Concert</h1>
      <p className="new-concert__subtitle">Record a concert you attended</p>
      {aiSearchEnabled && <ConcertMemoryAssistant />}
      <ConcertForm
        mode="create"
        currency={user?.currency || "EUR"}
        isAdmin={session.user.role === "admin"}
      />
    </div>
  )
}
