import React from "react"
import { notFound } from "next/navigation"
import Layout from "../../../src/components/layout-client"
import ConcertCard from "../../../src/components/ConcertCard/concertCard"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import { getAllConcerts, getConcertsByBand } from "@/lib/concerts"
import { getBandBySlug, getAllBandSlugs } from "@/lib/bands"
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
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [band, allConcerts] = await Promise.all([
    getBandBySlug(slug),
    getAllConcerts(),
  ])

  if (!band) {
    notFound()
  }

  const concerts = await getConcertsByBand(slug)

  // Transform for layout
  const allConcertsFormatted = allConcerts.map((c) => ({
    ...c,
    club: c.club ?? undefined,
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

  const concertsFormatted = {
    edges: concerts.map((c) => ({
      node: {
        ...c,
        club: c.club ?? undefined,
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
      },
    })),
    totalCount: concerts.length,
  }

  const hasGenres = band.lastfm?.genres && band.lastfm.genres.length > 0
  const hasLastfmUrl = Boolean(band.lastfm?.url)

  return (
    <Layout concerts={allConcertsFormatted}>
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

          <ul className="list-unstyled">
            {concerts.map((concert) => (
              <ConcertCard
                key={concert.id}
                concert={{
                  ...concert,
                  club: concert.club ?? undefined,
                  bands: concert.bands.map((b) => ({
                    id: b.id,
                    name: b.name,
                    slug: b.slug,
                    url: b.url,
                  })),
                  festival: concert.festival
                    ? {
                        fields: {
                          name: concert.festival.fields.name,
                          url: concert.festival.fields.url ?? undefined,
                        },
                      }
                    : null,
                }}
              />
            ))}
          </ul>
        </div>
      </main>
    </Layout>
  )
}
