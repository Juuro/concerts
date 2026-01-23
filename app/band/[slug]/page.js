import React from 'react'
import Layout from '../../../src/components/layout-client'
import ConcertCard from '../../../src/components/ConcertCard/concertCard'
import ConcertCount from '../../../src/components/ConcertCount/concertCount'
import { getAllBands, getConcertsByBand, getAllConcerts } from '../../../src/utils/data'
import { isFeatureEnabled, FEATURE_FLAGS } from '../../../src/utils/featureFlags'

export const dynamic = 'force-static'

export async function generateStaticParams() {
  const bands = await getAllBands()
  return bands.map((band) => ({
    slug: band.slug,
  }))
}

export async function generateMetadata({ params }) {
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

export default async function BandPage({ params }) {
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
    edges: concerts.map(c => ({ node: c })),
    totalCount: concerts.length,
  }

  return (
    <Layout concerts={allConcerts}>
      <main>
        <div className="container">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '20px',
            }}
          >
            <div>
              <h2>
                {band.name}
                <ConcertCount concerts={concertsFormatted} />
              </h2>
              {isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true) &&
                band.lastfm?.genres &&
                band.lastfm.genres.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <strong>Genres: </strong>
                    {band.lastfm.genres.slice(0, 5).map((genre) => (
                      <span
                        key={genre}
                        className="badge bg-secondary"
                        style={{ marginRight: '5px' }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              {isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true) &&
                band.lastfm?.url && (
                  <div style={{ marginTop: '10px' }}>
                    <a href={band.lastfm.url} target="_blank" rel="noopener noreferrer">
                      View on Last.fm →
                    </a>
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
