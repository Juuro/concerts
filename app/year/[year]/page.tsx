import React from "react"
import Layout from "../../../src/components/layout-client"
import ConcertCard from "../../../src/components/ConcertCard/concertCard"
import ConcertCount from "../../../src/components/ConcertCount/concertCount"
import { getAllYears, getConcertsByYear, getAllConcerts } from "@/lib/concerts"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  const years = await getAllYears()
  return years.map((year) => ({
    year: year,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>
}): Promise<Metadata> {
  const { year } = await params

  return {
    title: `${year} | Concerts`,
  }
}

export default async function YearPage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year } = await params
  const [concerts, allConcerts] = await Promise.all([
    getConcertsByYear(year),
    getAllConcerts(),
  ])

  // Transform for layout
  const allConcertsFormatted = allConcerts.map((c) => ({
    ...c,
    club: c.club ?? undefined,
    bands: c.bands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      url: b.url,
      image: b.imageUrl ? { fields: { file: { url: b.imageUrl } } } : undefined,
      lastfm: b.lastfm
        ? {
            url: b.lastfm.url ?? "",
            name: b.name,
            images: {
              small: "",
              medium: "",
              large: "",
              extralarge: "",
              mega: "",
            },
            genres: b.lastfm.genres ?? [],
            bio: b.lastfm.bio ?? null,
          }
        : undefined,
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
          image: b.imageUrl
            ? { fields: { file: { url: b.imageUrl } } }
            : undefined,
          lastfm: b.lastfm
            ? {
                url: b.lastfm.url ?? "",
                name: b.name,
                images: {
                  small: "",
                  medium: "",
                  large: "",
                  extralarge: "",
                  mega: "",
                },
                genres: b.lastfm.genres ?? [],
                bio: b.lastfm.bio ?? null,
              }
            : undefined,
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

  return (
    <Layout concerts={allConcertsFormatted}>
      <main>
        <div className="container">
          <h2>
            {year}
            <ConcertCount concerts={concertsFormatted} />
          </h2>

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
                    image: b.imageUrl
                      ? { fields: { file: { url: b.imageUrl } } }
                      : undefined,
                    lastfm: b.lastfm
                      ? {
                          url: b.lastfm.url ?? "",
                          name: b.name,
                          images: {
                            small: "",
                            medium: "",
                            large: "",
                            extralarge: "",
                            mega: "",
                          },
                          genres: b.lastfm.genres ?? [],
                          bio: b.lastfm.bio ?? null,
                        }
                      : undefined,
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
