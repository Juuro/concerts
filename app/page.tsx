import React from "react"
import Link from "next/link"
import Layout from "../src/components/layout-client"
import StatisticsWidgetServer from "../src/components/StatisticsWidget/StatisticsWidgetServer"
import StatCard from "@/components/StatCard/StatCard"
import FeatureCard from "@/components/FeatureCard/FeatureCard"
import { ConcertListInfinite } from "../src/components/ConcertList"
import {
  getConcertsPaginated,
  getUserConcertStatistics,
  getUserConcertCounts,
  getUserTotalSpent,
  getGlobalAppStats,
} from "@/lib/concerts"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import type { Metadata } from "next"
import "./home.scss"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Concerts",
  description: "Track your concert history.",
}

interface HomePageProps {
  searchParams: Promise<{ cursor?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { cursor } = await searchParams
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    return <LoggedInHome userId={session.user.id} cursor={cursor} />
  }

  return <LandingPage />
}

async function LoggedInHome({
  userId,
  cursor,
}: {
  userId: string
  cursor?: string
}) {
  const [
    initialData,
    totalConcerts,
    uniqueBandsData,
    userConcertCoords,
    uniqueYearsData,
    userStats,
    userCounts,
    totalSpent,
  ] = await Promise.all([
    getConcertsPaginated(cursor, 20, "forward", { userId }),
    prisma.concert.count({
      where: { userId },
    }),
    prisma.concertBand.groupBy({
      by: ["bandId"],
      where: { concert: { userId } },
    }),
    prisma.concert.findMany({
      where: { userId, normalizedCity: { not: null } },
      select: { normalizedCity: true },
      distinct: ["normalizedCity"],
    }),
    prisma.concert.findMany({
      where: { userId },
      select: { date: true },
    }),
    getUserConcertStatistics(userId),
    getUserConcertCounts(userId),
    getUserTotalSpent(userId),
  ])

  const uniqueBands = uniqueBandsData.length
  const uniqueCities = userConcertCoords.length
  const years = new Set(
    uniqueYearsData.map((c) => new Date(c.date).getFullYear())
  )

  return (
    <Layout concertCounts={userCounts}>
      <main>
        <div className="container">
          <div className="dashboard">
            <div className="dashboard__header">
              <h2 className="dashboard__title">My Concerts</h2>
              <Link href="/concerts/new" className="dashboard__add-btn">
                + Add Concert
              </Link>
            </div>

            {userStats.totalPast > 0 && <StatisticsWidgetServer statistics={userStats} />}

            <div className="dashboard__stats">
              <StatCard value={totalConcerts} label="Concerts" />
              <StatCard value={uniqueBands} label="Bands" />
              <StatCard value={uniqueCities} label="Cities" />
              <StatCard value={years.size} label="Years" />
              {totalSpent.total > 0 && (
                <StatCard value={Math.round(totalSpent.total)} label={totalSpent.currency} />
              )}
            </div>

            {initialData.items.length === 0 && !cursor ? (
              <div className="dashboard__empty">
                <h2>No concerts yet</h2>
                <p>Start building your concert collection by adding your first concert.</p>
                <Link href="/concerts/new" className="dashboard__add-btn">
                  Add Your First Concert
                </Link>
              </div>
            ) : (
              <div className="dashboard__concerts">
                <h2 className="dashboard__section-title">Recent Concerts</h2>
                <ConcertListInfinite
                  initialConcerts={initialData.items}
                  initialNextCursor={initialData.nextCursor}
                  initialHasMore={initialData.hasMore}
                  initialHasPrevious={initialData.hasPrevious}
                  filterParams={{ userOnly: "true" }}
                  showEditButtons={true}
                  currentUserId={userId}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </Layout>
  )
}

async function LandingPage() {
  const stats = await getGlobalAppStats()

  return (
    <Layout>
      <main>
        <div className="container">
          <section className="home-hero">
            <h2>Your concert history, beautifully tracked</h2>
            <p>
              Never forget a show. Track every concert, discover your patterns,
              and share your musical journey.
            </p>
            <Link href="/login" className="home-btn">
              Get Started
            </Link>
          </section>

          <section className="home-stats">
            <h3>Join the community</h3>
            <div className="home-stats__grid">
              <StatCard value={stats.concertCount.toLocaleString()} label="Concerts tracked" />
              <StatCard value={stats.bandCount.toLocaleString()} label="Bands" />
              <StatCard value={stats.userCount.toLocaleString()} label="Music fans" />
            </div>
          </section>

          <section className="home-features">
            <FeatureCard
              icon="🎶"
              title="Track every show"
              description="Log concerts with dates, venues, cities, and lineups. Build your complete concert history."
              iconClassName="home-features__icon"
              cardClassName="home-features__card"
            />
            <FeatureCard
              icon="📊"
              title="Discover patterns"
              description="See your top bands, favorite cities, and busiest years with beautiful charts and statistics."
              iconClassName="home-features__icon"
              cardClassName="home-features__card"
            />
            <FeatureCard
              icon="🌍"
              title="Map your journey"
              description="Visualize all your concerts on an interactive map. See how far your music has taken you."
              iconClassName="home-features__icon"
              cardClassName="home-features__card"
            />
          </section>

          <section className="home-cta">
            <h3>Ready to start tracking?</h3>
            <p>
              Sign in with GitHub to begin building your concert collection.
            </p>
            <Link href="/login" className="home-btn">
              Sign in with GitHub
            </Link>
          </section>
        </div>
      </main>
    </Layout>
  )
}
