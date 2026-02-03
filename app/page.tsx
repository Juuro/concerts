import React from "react"
import Layout from "../src/components/layout-client"
import StatisticsWidgetServer from "../src/components/StatisticsWidget/StatisticsWidgetServer"
import { ConcertListInfinite } from "../src/components/ConcertList"
import { ToastProvider } from "../src/components/Toast"
import { getConcertsPaginated, getConcertStatistics, getConcertCounts } from "@/lib/concerts"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Concerts",
  description: "List of all concerts and festivals I've visited.",
}

interface HomePageProps {
  searchParams: Promise<{ cursor?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { cursor } = await searchParams

  const [paginatedConcerts, statistics, counts] = await Promise.all([
    getConcertsPaginated(cursor, 20),
    getConcertStatistics(),
    getConcertCounts(),
  ])

  // Transform concerts to match expected format
  const concertsFormatted = paginatedConcerts.items.map((concert) => ({
    ...concert,
    club: concert.club ?? undefined,
    city: concert.city,
    bands: concert.bands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      url: b.url,
      image: b.imageUrl ? { fields: { file: { url: b.imageUrl } } } : undefined,
    })),
    festival: concert.festival
      ? {
          fields: {
            name: concert.festival.fields.name,
            url: concert.festival.fields.url ?? undefined,
          },
        }
      : null,
  }))

  return (
    <Layout concertCounts={counts}>
      <main>
        <div className="container">
          <StatisticsWidgetServer statistics={statistics} />
          <ToastProvider>
            <ConcertListInfinite
              initialConcerts={concertsFormatted}
              initialNextCursor={paginatedConcerts.nextCursor}
              initialHasMore={paginatedConcerts.hasMore}
              initialHasPrevious={paginatedConcerts.hasPrevious}
            />
          </ToastProvider>
        </div>
      </main>
    </Layout>
  )
}
