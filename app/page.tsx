import React from "react"
import Layout from "../src/components/layout-client"
import ConcertCard from "../src/components/ConcertCard/concertCard"
import StatisticsWidget from "../src/components/StatisticsWidget/statisticsWidget"
import { getAllConcerts } from "@/lib/concerts"
import { getAllBands } from "@/lib/bands"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Concerts",
  description: "List of all concerts and festivals I've visited.",
}

export default async function HomePage() {
  const concerts = await getAllConcerts()
  const bands = await getAllBands()

  // Transform concerts to match expected format
  const concertsFormatted = concerts.map((concert) => ({
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

  // Transform bands to match expected format
  const bandsFormatted = bands.map((band) => ({
    id: band.id,
    name: band.name,
    slug: band.slug,
    url: band.url,
    image: band.imageUrl
      ? { fields: { file: { url: band.imageUrl } } }
      : undefined,
    lastfm: band.lastfm
      ? {
          url: band.lastfm.url ?? "",
          name: band.name,
          images: {
            small: "",
            medium: "",
            large: "",
            extralarge: "",
            mega: "",
          },
          genres: band.lastfm.genres ?? [],
          bio: band.lastfm.bio ?? null,
        }
      : undefined,
    concert: band.concert,
  }))

  return (
    <Layout concerts={concertsFormatted}>
      <main>
        <div className="container">
          <StatisticsWidget
            concerts={concertsFormatted}
            bands={bandsFormatted}
          />
          <ul className="list-unstyled">
            {concertsFormatted.map((concert) => (
              <ConcertCard key={concert.id} concert={concert} />
            ))}
          </ul>
        </div>
      </main>
    </Layout>
  )
}
