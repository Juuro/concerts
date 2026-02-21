import React from "react"
import { redirect } from "next/navigation"
import Layout from "../../src/components/layout-client"
import MapClient from "../../src/components/MapClient"
import { getUserConcerts, getUserConcertCounts } from "@/lib/concerts"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Map | Concerts",
  description: "Map of all concerts",
}

export default async function MapPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  if (!session?.user) {
    redirect("/login")
  }

  const userId = session.user.id

  const [concerts, userCounts] = await Promise.all([
    getUserConcerts(userId),
    getUserConcertCounts(userId),
  ])

  // Transform for map
  const concertsFormatted = concerts.map((c) => ({
    ...c,
    bands: c.bands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      url: b.url,
    })),
    festival: c.festival
      ? {
          fields: {
            name: c.festival.fields.name,
            url: c.festival.fields.url ?? undefined,
          },
        }
      : null,
  }))

  return (
    <Layout concertCounts={userCounts}>
      <MapClient concerts={concertsFormatted} />
    </Layout>
  )
}
