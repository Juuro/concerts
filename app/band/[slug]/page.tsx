import React from "react"
import { notFound } from "next/navigation"
import Layout from "../../../src/components/layout-client"
import ConcertListInfinite from "../../../src/components/ConcertList/ConcertListInfinite"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import { getConcertCounts, getConcertsPaginated } from "@/lib/concerts"
import { getBandBySlug, getAllBandSlugs } from "@/lib/bands"
import { prisma } from "@/lib/prisma"
import type { Metadata } from "next"
import styles from "./page.module.scss"

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

  const [band, concertCounts] = await Promise.all([
    getBandBySlug(slug),
    getConcertCounts(),
  ])

  if (!band) {
    notFound()
  }

  // Fetch initial paginated concerts for this band
  const initialData = await getConcertsPaginated(cursor, 20, "forward", {
    bandSlug: slug,
  })

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
              {(hasGenres || hasLastfmUrl) && (
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
                </div>
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
