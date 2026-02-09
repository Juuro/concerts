import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getConcertsPaginated } from "@/lib/concerts"
import { prisma } from "@/lib/prisma"
import ConcertListInfinite from "@/components/ConcertList/ConcertListInfinite"
import "./dashboard.scss"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Dashboard - My Concerts",
  description: "Manage your concert collection",
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect("/login")
  }

  // Get search params
  const { cursor } = await searchParams

  // Fetch initial paginated concerts
  const initialData = await getConcertsPaginated(
    cursor,
    20,
    'forward',
    { userId: session.user.id }
  )

  // Calculate statistics using separate count/aggregation queries
  const [totalConcerts, uniqueBandsData, uniqueCitiesData, uniqueYearsData] = await Promise.all([
    prisma.concert.count({
      where: { userId: session.user.id }
    }),
    prisma.concertBand.groupBy({
      by: ['bandId'],
      where: {
        concert: { userId: session.user.id }
      }
    }),
    prisma.concert.groupBy({
      by: ['city'],
      where: {
        userId: session.user.id,
        city: { not: null }
      }
    }),
    prisma.concert.findMany({
      where: { userId: session.user.id },
      select: { date: true }
    })
  ])

  const uniqueBands = uniqueBandsData.length
  const uniqueCities = uniqueCitiesData.length
  const years = new Set(uniqueYearsData.map((c) => new Date(c.date).getFullYear()))

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">My Concerts</h1>
          <p className="dashboard__subtitle">
            Welcome back, {session.user.name || "friend"}!
          </p>
        </div>
        <Link href="/concerts/new" className="dashboard__add-btn">
          + Add Concert
        </Link>
      </div>

      <div className="dashboard__stats">
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
        <div className="dashboard__empty">
          <h2>No concerts yet</h2>
          <p>
            Start building your concert collection by adding your first concert.
          </p>
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
            filterParams={{ userOnly: 'true' }}
            showEditButtons={true}
            currentUserId={session.user.id}
          />
        </div>
      )}
    </div>
  )
}
