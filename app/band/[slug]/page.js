import React from 'react'
import Layout from '../../../src/components/layout-client'
import ConcertCard from '../../../src/components/ConcertCard/concertCard-next'
import ConcertCount from '../../../src/components/ConcertCount/concertCount'
import { getAllBands, getConcertsByBand, getAllConcerts } from '../../../src/utils/data'

export async function generateStaticParams() {
  const bands = await getAllBands()
  return bands.map((band) => ({
    slug: band.slug,
  }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const bands = await getAllBands()
  const band = bands.find((b) => b.slug === slug)
  
  return {
    title: `${band?.name || slug} | Concerts`,
  }
}

export default async function BandPage({ params }) {
  const { slug } = await params
  const bands = await getAllBands()
  const band = bands.find((b) => b.slug === slug)
  const concerts = await getConcertsByBand(slug)
  const allConcerts = await getAllConcerts()

  if (!band) {
    return <div>Band not found</div>
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
              {band.lastfm?.genres && band.lastfm.genres.length > 0 && (
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
              {band.lastfm?.url && (
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
