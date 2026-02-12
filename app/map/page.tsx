import React from "react"
import Layout from "../../src/components/layout-client"
import MapClient from "../../src/components/MapClient"
import { getAllConcerts, getConcertCounts } from "@/lib/concerts"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Map | Concerts",
  description: "Map of all concerts",
}

export default async function MapPage() {
  const [concerts, concertCounts] = await Promise.all([
    getAllConcerts(),
    getConcertCounts(),
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
    <Layout concertCounts={concertCounts}>
      <MapClient concerts={concertsFormatted} />
    </Layout>
  )
}
