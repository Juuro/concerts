import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getUserConcerts } from "@/lib/concerts"
import Header from "@/components/Header/header"
import ConcertCard from "@/components/ConcertCard/concertCard"
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
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

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

  const concerts = await getUserConcerts(user.id)

  // Calculate statistics
  const totalConcerts = concerts.length
  const uniqueBands = new Set(
    concerts.flatMap((c) => c.bands.map((b) => b.slug))
  ).size
  const uniqueCities = new Set(
    concerts.map((c) => c.fields.geocoderAddressFields._normalized_city)
  ).size
  const years = new Set(concerts.map((c) => new Date(c.date).getFullYear()))

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
              />
            ) : (
              <div className="public-profile__avatar public-profile__avatar--placeholder">
                {(user.name || user.username || "U")[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="public-profile__name">
                {user.name || user.username}
              </h1>
              <p className="public-profile__username">@{user.username}</p>
            </div>
          </div>

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

          {concerts.length === 0 ? (
            <div className="public-profile__empty">
              <p>No concerts to show yet.</p>
            </div>
          ) : (
            <div className="public-profile__concerts">
              <h2 className="public-profile__section-title">Concert History</h2>
              <div className="public-profile__concert-list">
                {concerts.map((concert) => (
                  <ConcertCard
                    key={concert.id}
                    concert={{
                      id: concert.id,
                      date: concert.date,
                      city: concert.city,
                      club: concert.club ?? undefined,
                      bands: concert.bands.map((b) => ({
                        id: b.id,
                        name: b.name,
                        slug: b.slug,
                        url: b.url,
                        image: b.imageUrl
                          ? { fields: { file: { url: b.imageUrl } } }
                          : undefined,
                      })),
                      isFestival: concert.isFestival,
                      festival: concert.festival
                        ? {
                            fields: {
                              name: concert.festival.fields.name,
                              url: concert.festival.fields.url ?? undefined,
                            },
                          }
                        : null,
                      fields: concert.fields,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
