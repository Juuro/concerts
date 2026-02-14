import React from "react"
import { notFound } from "next/navigation"
import Layout from "../../../src/components/layout-client"
import ConcertListInfinite from "../../../src/components/ConcertList/ConcertListInfinite"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import { getConcertCounts, getConcertsPaginated, getUserTotalSpent } from "@/lib/concerts"
import { getBandBySlug, getAllBandSlugs } from "@/lib/bands"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import type { Metadata } from "next"
import styles from "./page.module.scss"
import BandEditToggle from "./BandEditToggle"

export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  const slugs = await getAllBandSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const band = await getBandBySlug(slug)

  return {
    title: `${band?.name || slug} | Concerts`,
  }
}

export default async function BandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const { slug } = await params
  const { cursor } = await searchParams

  const [band, concertCounts, session] = await Promise.all([
    getBandBySlug(slug),
    getConcertCounts(),
    auth.api.getSession({ headers: await headers() }).catch(() => null),
  ])

  if (!band) {
    notFound()
  }

  // Fetch initial paginated concerts and spending for this band
  const [initialData, bandSpent] = await Promise.all([
    getConcertsPaginated(cursor, 20, "forward", { bandSlug: slug }),
    session?.user
      ? getUserTotalSpent(session.user.id, { bandSlug: slug })
      : Promise.resolve(null),
  ])

  // Calculate past/future counts for this band's concerts
  const now = new Date()
  const [pastCount, futureCount] = await Promise.all([
    prisma.concert.count({
      where: {
        bands: { some: { band: { slug } } },
        date: { lt: now },
      },
    }),
    prisma.concert.count({
      where: {
        bands: { some: { band: { slug } } },
        date: { gte: now },
      },
    }),
  ])

  const bandConcertCounts = {
    past: pastCount,
    future: futureCount,
  }

  const hasGenres = band.lastfm?.genres && band.lastfm.genres.length > 0
  const hasLastfmUrl = Boolean(band.lastfm?.url)
  const hasWebsiteUrl = Boolean(band.websiteUrl)

  return (
    <Layout concertCounts={concertCounts}>
      <main>
        <div className="container">
          <div className={styles.headerRow}>
            <div>
              <h2>
                {band.name}
                <ConcertCount counts={bandConcertCounts} />
              </h2>
              {(hasGenres || hasLastfmUrl || hasWebsiteUrl || session?.user) && (
                <div className={styles.metaRow}>
                  {hasGenres && (
                    <span className={styles.genreBadges}>
                      {band.lastfm!.genres!.slice(0, 5).map((genre) => (
                        <span key={genre} className={styles.genreBadge}>
                          {genre}
                        </span>
                      ))}
                    </span>
                  )}
                  {hasWebsiteUrl && (
                    <a
                      className={styles.websiteLink}
                      href={band.websiteUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Visit website"
                      title="Visit website"
                    >
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 3c-2 2.5-3 5-3 9s1 6.5 3 9M12 3c2 2.5 3 5 3 9s-1 6.5-3 9M3.5 9h17M3.5 15h17"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </a>
                  )}
                  {hasLastfmUrl && (
                    <a
                      className={styles.lastfmLink}
                      href={band.lastfm!.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View on Last.fm"
                      title="View on Last.fm"
                    >
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <text
                          x="12"
                          y="12"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="7.5"
                          fontWeight="700"
                          fontFamily="sans-serif"
                          fill="currentColor"
                        >
                          lfm
                        </text>
                      </svg>
                    </a>
                  )}
                  {session?.user && (
                    <BandEditToggle
                      band={{
                        slug: band.slug,
                        name: band.name,
                        imageUrl: band.imageUrl ?? undefined,
                        websiteUrl: band.websiteUrl ?? undefined,
                      }}
                    />
                  )}
                </div>
              )}
              {bandSpent && bandSpent.total > 0 && (
                <p className={styles.spendingStat}>
                  {bandSpent.total.toFixed(2)} {bandSpent.currency} spent
                </p>
              )}
            </div>
          </div>

          <ConcertListInfinite
            initialConcerts={initialData.items}
            initialNextCursor={initialData.nextCursor}
            initialHasMore={initialData.hasMore}
            initialHasPrevious={initialData.hasPrevious}
            filterParams={{ bandSlug: slug }}
          />
        </div>
      </main>
    </Layout>
  )
}
