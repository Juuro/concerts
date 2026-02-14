import React from "react"
import { notFound } from "next/navigation"
import Layout from "../../../src/components/layout-client"
import ConcertListInfinite from "../../../src/components/ConcertList/ConcertListInfinite"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import {
  getAllCities,
  getConcertsPaginated,
  getConcertCounts,
  getUserTotalSpent,
} from "@/lib/concerts"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
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

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  const now = new Date()

  const [concertCounts, initialData, pastCount, futureCount, citySpent] = await Promise.all([
    getConcertCounts(),
    getConcertsPaginated(cursor, 20, "forward", { city: cityName }),
    prisma.concert.count({
      where: { normalizedCity: cityName, date: { lt: now } },
    }),
    prisma.concert.count({
      where: { normalizedCity: cityName, date: { gte: now } },
    }),
    session?.user
      ? getUserTotalSpent(session.user.id, { city: cityName })
      : Promise.resolve(null),
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
          {citySpent && citySpent.total > 0 && (
            <p style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.55)', margin: '4px 0 16px' }}>
              {citySpent.total.toFixed(2)} {citySpent.currency} spent
            </p>
          )}

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
