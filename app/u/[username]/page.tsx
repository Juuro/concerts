import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getConcertsPaginated, getUserConcerts, getUserConcertStatistics, getUserConcertCounts } from "@/lib/concerts"
import Header from "@/components/Header/header"
import ConcertListInfinite from "@/components/ConcertList/ConcertListInfinite"
import StatisticsWidgetServer from "@/components/StatisticsWidget/StatisticsWidgetServer"
import StatCard from "@/components/StatCard/StatCard"
import ConcertCount from "@/components/ConcertCount/concertCount"
import MapClient from "@/components/MapClient"
import "./profile.scss"
import Image from "next/image"

export const revalidate = 3600 // Revalidate every hour

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: { name: true, username: true, isPublic: true },
  })

  if (!user || !user.isPublic) {
    return { title: "Profile Not Found" }
  }

  return {
    title: `${user.name || user.username}'s Concerts`,
    description: `View the concert collection of ${user.name || user.username}`,
  }
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const { username } = await params
  const { cursor } = await searchParams

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      isPublic: true,
    },
  })

  if (!user || !user.isPublic) {
    notFound()
  }

  // Fetch initial paginated concerts
  const initialData = await getConcertsPaginated(
    cursor,
    20,
    'forward',
    { userId: user.id, isPublic: true }
  )

  // Calculate statistics using separate count/aggregation queries
  const [totalConcerts, uniqueBandsData, userConcertCoords, uniqueYearsData, userStats, userCounts, allUserConcerts] = await Promise.all([
    prisma.concert.count({
      where: { userId: user.id }
    }),
    prisma.concertBand.groupBy({
      by: ['bandId'],
      where: { concert: { userId: user.id } }
    }),
    prisma.concert.findMany({
      where: { userId: user.id, normalizedCity: { not: null } },
      select: { normalizedCity: true },
      distinct: ["normalizedCity"],
    }),
    prisma.concert.findMany({
      where: { userId: user.id },
      select: { date: true }
    }),
    getUserConcertStatistics(user.id),
    getUserConcertCounts(user.id),
    getUserConcerts(user.id),
  ])

  const uniqueBands = uniqueBandsData.length
  const uniqueCities = userConcertCoords.length
  const years = new Set(uniqueYearsData.map((c) => new Date(c.date).getFullYear()))

  const concertsForMap = allUserConcerts.map((c) => ({
    ...c,
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

  return (
    <>
      <Header siteTitle="Concerts" />
      <main className="container">
        <div className="public-profile">
          <div className="public-profile__header">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || user.username || ""}
                className="public-profile__avatar"
                width={80}
                height={80}
              />
            ) : (
              <div className="public-profile__avatar public-profile__avatar--placeholder">
                {(user.name || user.username || "U")[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="public-profile__name">
                {user.name || user.username}
                <ConcertCount counts={userCounts} />
              </h1>
              <p className="public-profile__username">@{user.username}</p>
            </div>
          </div>

          {userStats.totalPast > 0 && <StatisticsWidgetServer statistics={userStats} />}

          <div className="public-profile__stats">
            <StatCard value={totalConcerts} label="Concerts" />
            <StatCard value={uniqueBands} label="Bands" />
            <StatCard value={uniqueCities} label="Cities" />
            <StatCard value={years.size} label="Years" />
          </div>

          {concertsForMap.length > 0 && (
            <div className="public-profile__map">
              <h2 className="public-profile__section-title">Concert Map</h2>
              <MapClient concerts={concertsForMap} allowFullscreen />
            </div>
          )}

          {initialData.items.length === 0 && !cursor ? (
            <div className="public-profile__empty">
              <p>No concerts to show yet.</p>
            </div>
          ) : (
            <div className="public-profile__concerts">
              <h2 className="public-profile__section-title">Concert History</h2>
              <ConcertListInfinite
                initialConcerts={initialData.items}
                initialNextCursor={initialData.nextCursor}
                initialHasMore={initialData.hasMore}
                initialHasPrevious={initialData.hasPrevious}
                filterParams={{ username }}
              />
            </div>
          )}
        </div>
      </main>
    </>
  )
}
