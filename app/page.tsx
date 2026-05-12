import React, { Suspense } from "react"
import Link from "next/link"
import Layout from "../src/components/layout-client"
import HeroBanner from "@/components/HeroBanner/heroBanner"
import StatisticsWidgetServer from "../src/components/StatisticsWidget/StatisticsWidgetServer"
import StatCard from "@/components/StatCard/StatCard"
import FeatureCard from "@/components/FeatureCard/FeatureCard"
import { ConcertListInfinite } from "../src/components/ConcertList"
import {
  getUserConcertStatistics,
  getUserConcertCounts,
  getGlobalAppStats,
  getUserUniqueBandCount,
  getUserDashboardCounts,
} from "@/lib/concerts/stats"
import { getUserTotalSpentCached } from "@/lib/concerts/spending"
import { getConcertsPaginated } from "@/lib/concerts/pagination"
import { auth } from "@/lib/auth"
import { FEATURE_FLAGS, isFeatureEnabled } from "@/utils/featureFlags"
import { headers } from "next/headers"
import type { Metadata } from "next"
import "./home.scss"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://concertivity.app"

export const metadata: Metadata = {
  title: "Concertivity — Track Your Concert History",
  description:
    "Never forget a show. Log every concert, discover your patterns, and share your musical journey with Concertivity.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Concertivity — Track Your Concert History",
    description:
      "Never forget a show. Log every concert, discover your patterns, and share your musical journey with Concertivity.",
    url: siteUrl,
    type: "website",
  },
}

interface HomePageProps {
  searchParams: Promise<{ cursor?: string }>
}

function HomePageFallback() {
  return (
    <Layout>
      <main>
        <div className="container">
          <p aria-live="polite">Loading…</p>
        </div>
      </main>
    </Layout>
  )
}

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    return <LoggedInHome userId={session.user.id} cursor={cursor} />
  }

  return <LandingPage />
}

export default function HomePage({ searchParams }: HomePageProps) {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  )
}

async function LoggedInHome({
  userId,
  cursor,
}: {
  userId: string
  cursor?: string
}) {
  const showStatisticsWidget = isFeatureEnabled(
    FEATURE_FLAGS.ENABLE_STATISTICS_WIDGET,
    false
  )

  const [
    initialData,
    uniqueBands,
    dashboardCounts,
    userStats,
    userCounts,
    totalSpent,
  ] = await Promise.all([
    getConcertsPaginated(cursor, 20, "forward", { userId }),
    getUserUniqueBandCount(userId),
    getUserDashboardCounts(userId),
    showStatisticsWidget
      ? getUserConcertStatistics(userId)
      : Promise.resolve(null),
    getUserConcertCounts(userId),
    getUserTotalSpentCached(userId),
  ])

  return (
    <Layout concertCounts={userCounts}>
      <main>
        <div className="container">
          <div className="home-header">
            <h2>Concerts</h2>
            <Link href="/concerts/new" className="home-btn">
              + Add Concert
            </Link>
          </div>

          {showStatisticsWidget && userStats && userStats.totalPast > 0 && (
            <StatisticsWidgetServer statistics={userStats} />
          )}

          <div className="home-dashboard-stats">
            <StatCard value={userCounts.past} label="Concerts" />
            <StatCard value={uniqueBands} label="Bands" />
            <StatCard value={dashboardCounts.uniqueCities} label="Cities" />
            <StatCard value={dashboardCounts.uniqueYears} label="Years" />
            {totalSpent.total > 0 && (
              <StatCard
                value={Math.round(totalSpent.total)}
                label={totalSpent.currency}
              />
            )}
          </div>

          {initialData.items.length === 0 && !cursor ? (
            <div className="home-empty">
              <h2>No concerts yet</h2>
              <p>
                Start building your concert collection by adding your first
                concert.
              </p>
              <Link href="/concerts/new" className="home-btn">
                Add Your First Concert
              </Link>
            </div>
          ) : (
            <ConcertListInfinite
              initialConcerts={initialData.items}
              initialNextCursor={initialData.nextCursor}
              initialHasMore={initialData.hasMore}
              initialHasPrevious={initialData.hasPrevious}
              filterParams={{ userOnly: "true" }}
              showEditButtons={true}
              currentUserId={userId}
              currency={totalSpent.currency}
            />
          )}
        </div>
      </main>
    </Layout>
  )
}

async function LandingPage() {
  const [stats, headersList] = await Promise.all([getGlobalAppStats(), headers()])
  const nonce = headersList.get("x-nonce") ?? undefined

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Concertivity",
    url: siteUrl,
    description:
      "Track every concert you've ever attended. Discover your top bands, favourite cities, and most active years.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/u/{username}`,
      },
      "query-input": "required name=username",
    },
  }

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Concertivity",
    url: siteUrl,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "A personal concert-attendance tracker. Log every show, explore statistics, and share your musical journey.",
  }

  return (
    <Layout>
      <main>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
        />
        <div className="container">
          <HeroBanner />
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
              <StatCard
                value={stats.concertCount.toLocaleString()}
                label="Concerts tracked"
              />
              <StatCard
                value={stats.bandCount.toLocaleString()}
                label="Bands"
              />
              <StatCard
                value={stats.userCount.toLocaleString()}
                label="Music fans"
              />
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
              Create a free account to begin building your concert collection.
            </p>
            <Link href="/login" className="home-btn">
              Get Started
            </Link>
          </section>
        </div>
      </main>
    </Layout>
  )
}
