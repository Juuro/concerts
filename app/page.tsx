import React from "react"
import Link from "next/link"
import Layout from "../src/components/layout-client"
import StatisticsWidgetServer from "../src/components/StatisticsWidget/StatisticsWidgetServer"
import { ConcertListInfinite } from "../src/components/ConcertList"
import {
  getConcertsPaginated,
  getUserConcertStatistics,
  getUserConcertCounts,
  getGlobalAppStats,
} from "@/lib/concerts"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import type { Metadata } from "next"
import "./u/[username]/profile.scss"
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
          <div className="public-profile">
            <StatisticsWidgetServer statistics={userStats} />

            <div className="public-profile__stats">
              <div className="stat-card">
                <span className="stat-card__value">{totalConcerts}</span>
                <span className="stat-card__label">Concerts</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__value">{uniqueBands}</span>
                <span className="stat-card__label">Bands</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__value">{uniqueCities}</span>
                <span className="stat-card__label">Cities</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__value">{years.size}</span>
                <span className="stat-card__label">Years</span>
              </div>
            </div>

            {initialData.items.length === 0 && !cursor ? (
              <div className="public-profile__empty">
                <p>No concerts to show yet.</p>
              </div>
            ) : (
              <div className="public-profile__concerts">
                <h2 className="public-profile__section-title">
                  Concert History
                </h2>
                <ConcertListInfinite
                  initialConcerts={initialData.items}
                  initialNextCursor={initialData.nextCursor}
                  initialHasMore={initialData.hasMore}
                  initialHasPrevious={initialData.hasPrevious}
                  filterParams={{ userOnly: "true" }}
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
              <div className="stat-card">
                <span className="stat-card__value">
                  {stats.concertCount.toLocaleString()}
                </span>
                <span className="stat-card__label">Concerts tracked</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__value">
                  {stats.bandCount.toLocaleString()}
                </span>
                <span className="stat-card__label">Bands</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__value">
                  {stats.userCount.toLocaleString()}
                </span>
                <span className="stat-card__label">Music fans</span>
              </div>
            </div>
          </section>

          <section className="home-features">
            <div className="home-features__card card">
              <h4>Track every show</h4>
              <p>
                Log concerts with dates, venues, cities, and lineups. Build your
                complete concert history.
              </p>
            </div>
            <div className="home-features__card card">
              <h4>Discover patterns</h4>
              <p>
                See your top bands, favorite cities, and busiest years with
                beautiful charts and statistics.
              </p>
            </div>
            <div className="home-features__card card">
              <h4>Map your journey</h4>
              <p>
                Visualize all your concerts on an interactive map. See how far
                your music has taken you.
              </p>
            </div>
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
