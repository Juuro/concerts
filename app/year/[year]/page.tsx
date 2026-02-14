import React from "react"
import Layout from "../../../src/components/layout-client"
import ConcertListInfinite from "../../../src/components/ConcertList/ConcertListInfinite"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import {
  getAllYears,
  getConcertsPaginated,
  getConcertCounts,
  getUserTotalSpent,
} from "@/lib/concerts"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
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
  searchParams,
}: {
  params: Promise<{ year: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const { year } = await params
  const { cursor } = await searchParams
  const yearNum = parseInt(year, 10)

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  const [concertCounts, initialData, yearSpent] = await Promise.all([
    getConcertCounts(),
    getConcertsPaginated(cursor, 20, "forward", { year: yearNum }),
    session?.user
      ? getUserTotalSpent(session.user.id, { year: yearNum })
      : Promise.resolve(null),
  ])

  // Calculate past/future counts for this year's concerts
  const now = new Date()
  const yearStart = new Date(yearNum, 0, 1)
  const yearEnd = new Date(yearNum, 11, 31, 23, 59, 59, 999)

  const [pastCount, futureCount] = await Promise.all([
    prisma.concert.count({
      where: {
        date: {
          gte: yearStart,
          lt: now,
        },
      },
    }),
    prisma.concert.count({
      where: {
        date: {
          gte: now,
          lte: yearEnd,
        },
      },
    }),
  ])

  const yearConcertCounts = {
    past: pastCount,
    future: futureCount,
  }

  return (
    <Layout concertCounts={concertCounts}>
      <main>
        <div className="container">
          <h2>
            {year}
            <ConcertCount counts={yearConcertCounts} />
          </h2>
          {yearSpent && yearSpent.total > 0 && (
            <p style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.55)', margin: '4px 0 16px' }}>
              {yearSpent.total.toFixed(2)} {yearSpent.currency} spent
            </p>
          )}

          <ConcertListInfinite
            initialConcerts={initialData.items}
            initialNextCursor={initialData.nextCursor}
            initialHasMore={initialData.hasMore}
            initialHasPrevious={initialData.hasPrevious}
            filterParams={{ year }}
          />
        </div>
      </main>
    </Layout>
  )
}
