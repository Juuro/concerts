import React from "react"
import Layout from "../../../src/components/layout-client"
import ConcertCard from "../../../src/components/ConcertCard/concertCard"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import {
  getAllBands,
  getConcertsByBand,
  getAllConcerts,
} from "../../../src/utils/data"
import {
  isFeatureEnabled,
  FEATURE_FLAGS,
} from "../../../src/utils/featureFlags"
import type { Metadata } from "next"
import styles from "./page.module.scss"

export const dynamic = "force-static"

export async function generateStaticParams() {
  const bands = await getAllBands()
  return bands.map((band) => ({
    slug: band.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  // Fetch data once and reuse
  const [bands, allConcerts] = await Promise.all([
    getAllBands(),
    getAllConcerts(),
  ])
  const band = bands.find((b) => b.slug === slug)

  return {
    title: `${band?.name || slug} | Concerts`,
  }
}

export default async function BandPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // Fetch data once and reuse (prevents duplicate API calls)
  const [bands, allConcerts] = await Promise.all([
    getAllBands(),
    getAllConcerts(),
  ])
  const band = bands.find((b) => b.slug === slug)
  const concerts = await getConcertsByBand(slug)

  if (!band) {
    return (
      <Layout concerts={allConcerts}>
        <main>
          <div className="container">
            <h2>Band not found</h2>
            <p>The band you are looking for does not exist.</p>
          </div>
        </main>
      </Layout>
    )
  }

  const concertsFormatted = {
    edges: concerts.map((c) => ({ node: c })),
    totalCount: concerts.length,
  }
  const lastfmEnabled = isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true)
  const hasGenres =
    lastfmEnabled && band.lastfm?.genres && band.lastfm.genres.length > 0
  const hasLastfmUrl = lastfmEnabled && Boolean(band.lastfm?.url)

  return (
    <Layout concerts={allConcerts}>
      <main>
        <div className="container">
          <div className={styles.headerRow}>
            <div>
              <h2>
                {band.name}
                <ConcertCount concerts={concertsFormatted} />
              </h2>
              {(hasGenres || hasLastfmUrl) && (
                <div className={styles.metaRow}>
                  {hasGenres && (
                    <span className={styles.genreBadges}>
                      {band.lastfm!.genres.slice(0, 5).map((genre) => (
                        <span key={genre} className={styles.genreBadge}>
                          {genre}
                        </span>
                      ))}
                    </span>
                  )}
                  {hasLastfmUrl && (
                    <a
                      className={styles.lastfmLink}
                      href={band.lastfm!.url}
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

          <ul className="list-unstyled">
            {concerts.map((concert) => {
              return <ConcertCard key={concert.id} concert={concert} />
            })}
          </ul>
        </div>
      </main>
    </Layout>
  )
}
