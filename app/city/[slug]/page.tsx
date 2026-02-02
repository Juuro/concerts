import React from "react"
import { notFound } from "next/navigation"
import Layout from "../../../src/components/layout-client"
import ConcertCard from "../../../src/components/ConcertCard/concertCard"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import { getAllCities, getConcertsByCity, getAllConcerts } from "@/lib/concerts"
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

  const [concerts, allConcerts] = await Promise.all([
    getConcertsByCity(cityName),
    getAllConcerts(),
  ])

  // Transform for layout
  const allConcertsFormatted = allConcerts.map((c) => ({
    ...c,
    club: c.club ?? undefined,
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

  const concertsFormatted = {
    edges: concerts.map((c) => ({
      node: {
        ...c,
        club: c.club ?? undefined,
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
      },
    })),
    totalCount: concerts.length,
  }

  return (
    <Layout concerts={allConcertsFormatted}>
      <main>
        <div className="container">
          <h2>
            {cityName}
            <ConcertCount concerts={concertsFormatted} />
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
