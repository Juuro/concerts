import React from "react"
import { notFound } from "next/navigation"
import Layout from "../../../src/components/layout-client"
import ConcertCard from "../../../src/components/ConcertCard/concertCard"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import { getAllCities, getConcertsByCity, getConcertCounts } from "@/lib/concerts"
import { cityToSlug, findCityBySlug } from "../../../src/utils/helpers"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  const cities = await getAllCities()
  return cities.map((city) => ({
    slug: cityToSlug(city),
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cities = await getAllCities()
  const city = findCityBySlug(slug, cities)

  return {
    title: `${city || slug} | Concerts`,
  }
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cities = await getAllCities()
  const cityName = findCityBySlug(slug, cities)

  if (!cityName) {
    notFound()
  }

  const [concerts, concertCounts] = await Promise.all([
    getConcertsByCity(cityName),
    getConcertCounts(),
  ])

  // Calculate past/future counts for this city's concerts
  const now = new Date()
  const cityConcertCounts = {
    past: concerts.filter((c) => new Date(c.date) < now).length,
    future: concerts.filter((c) => new Date(c.date) >= now).length,
  }

  return (
    <Layout concertCounts={concertCounts}>
      <main>
        <div className="container">
          <h2>
            {cityName}
            <ConcertCount counts={cityConcertCounts} />
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
