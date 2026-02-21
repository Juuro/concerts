import React from "react"
import Layout from "../../../src/components/layout-client"
import ConcertListInfinite from "../../../src/components/ConcertList/ConcertListInfinite"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import {
  getAllYears,
  getConcertsPaginated,
  getUserConcertCounts,
  getUserTotalSpent,
} from "@/lib/concerts"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
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

  if (!session?.user) {
    redirect("/login")
  }

  const userId = session.user.id

  // Fetch user-scoped data for this year
  const now = new Date()
  const yearStart = new Date(yearNum, 0, 1)
  const yearEnd = new Date(yearNum, 11, 31, 23, 59, 59, 999)

  const [userCounts, initialData, yearSpent, pastCount, futureCount] = await Promise.all([
    getUserConcertCounts(userId),
    getConcertsPaginated(cursor, 20, "forward", { year: yearNum, userId }),
    getUserTotalSpent(userId, { year: yearNum }),
    prisma.concert.count({
      where: {
        userId,
        date: {
          gte: yearStart,
          lte: yearEnd,
          lt: now,
        },
      },
    }),
    prisma.concert.count({
      where: {
        userId,
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
    <Layout concertCounts={userCounts}>
      <main>
        <div className="container">
          <h2>
            {year}
            <ConcertCount counts={yearConcertCounts} />
          </h2>
          {yearSpent.total > 0 && (
            <p style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.55)', margin: '4px 0 16px' }}>
              {yearSpent.total.toFixed(2)} {yearSpent.currency} spent
            </p>
          )}

          <ConcertListInfinite
            initialConcerts={initialData.items}
            initialNextCursor={initialData.nextCursor}
            initialHasMore={initialData.hasMore}
            initialHasPrevious={initialData.hasPrevious}
            filterParams={{ year, userOnly: 'true' }}
          />
        </div>
      </main>
    </Layout>
  )
}
