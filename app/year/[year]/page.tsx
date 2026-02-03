import React from "react"
import Layout from "../../../src/components/layout-client"
import ConcertCard from "../../../src/components/ConcertCard/concertCard"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import { getAllYears, getConcertsByYear, getConcertCounts } from "@/lib/concerts"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  const years = await getAllYears()
  return years.map((year) => ({
    year: year,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>
}): Promise<Metadata> {
  const { year } = await params

  return {
    title: `${year} | Concerts`,
  }
}

export default async function YearPage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year } = await params
  const [concerts, concertCounts] = await Promise.all([
    getConcertsByYear(year),
    getConcertCounts(),
  ])

  // Calculate past/future counts for this year's concerts
  const now = new Date()
  const yearConcertCounts = {
    past: concerts.filter((c) => new Date(c.date) < now).length,
    future: concerts.filter((c) => new Date(c.date) >= now).length,
  }

  return (
    <Layout concertCounts={concertCounts}>
      <main>
        <div className="container">
          <h2>
            {year}
            <ConcertCount counts={yearConcertCounts} />
          </h2>

          <ul className="list-unstyled">
            {concerts.map((concert) => (
              <ConcertCard
                key={concert.id}
                concert={{
                  ...concert,
                  club: concert.club ?? undefined,
                  bands: concert.bands.map((b) => ({
                    id: b.id,
                    name: b.name,
                    slug: b.slug,
                    url: b.url,
                    image: b.imageUrl
                      ? { fields: { file: { url: b.imageUrl } } }
                      : undefined,
                    lastfm: b.lastfm
                      ? {
                          url: b.lastfm.url ?? "",
                          name: b.name,
                          images: {
                            small: "",
                            medium: "",
                            large: "",
                            extralarge: "",
                            mega: "",
                          },
                          genres: b.lastfm.genres ?? [],
                          bio: b.lastfm.bio ?? null,
                        }
                      : undefined,
                  })),
                  festival: concert.festival
                    ? {
                        fields: {
                          name: concert.festival.fields.name,
                          url: concert.festival.fields.url ?? undefined,
                        },
                      }
                    : null,
                }}
              />
            ))}
          </ul>
        </div>
      </main>
    </Layout>
  )
}
