import React from "react"
import { notFound } from "next/navigation"
import Layout from "../../../src/components/layout-client"
import ConcertListInfinite from "../../../src/components/ConcertList/ConcertListInfinite"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import {
  getAllCities,
  getConcertsPaginated,
  getConcertCounts,
} from "@/lib/concerts"
import { prisma } from "@/lib/prisma"
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
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const { slug } = await params
  const { cursor } = await searchParams
  const cities = await getAllCities()
  const cityName = findCityBySlug(slug, cities)

  if (!cityName) {
    notFound()
  }

  const now = new Date()

  const [concertCounts, initialData, pastCount, futureCount] = await Promise.all([
    getConcertCounts(),
    getConcertsPaginated(cursor, 20, "forward", { city: cityName }),
    prisma.concert.count({
      where: { normalizedCity: cityName, date: { lt: now } },
    }),
    prisma.concert.count({
      where: { normalizedCity: cityName, date: { gte: now } },
    }),
  ])

  const cityConcertCounts = {
    past: pastCount,
    future: futureCount,
  }

  return (
    <Layout concertCounts={concertCounts}>
      <main>
        <div className="container">
          <h2>
            {cityName}
            <ConcertCount counts={cityConcertCounts} />
          </h2>

          <ConcertListInfinite
            initialConcerts={initialData.items}
            initialNextCursor={initialData.nextCursor}
            initialHasMore={initialData.hasMore}
            initialHasPrevious={initialData.hasPrevious}
            filterParams={{ city: cityName }}
          />
        </div>
      </main>
    </Layout>
  )
}
