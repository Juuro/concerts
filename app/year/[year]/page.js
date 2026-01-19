import React from 'react'
import Layout from '../../../src/components/layout-client'
import ConcertCard from '../../../src/components/ConcertCard/concertCard-next'
import ConcertCount from '../../../src/components/ConcertCount/concertCount'
import { getAllYears, getConcertsByYear, getAllConcerts } from '../../../src/utils/data'

export async function generateStaticParams() {
  const years = await getAllYears()
  return years.map((year) => ({
    year: year,
  }))
}

export async function generateMetadata({ params }) {
  const { year } = await params
  
  return {
    title: `${year} | Concerts`,
  }
}

export default async function YearPage({ params }) {
  const { year } = await params
  const concerts = await getConcertsByYear(year)
  const allConcerts = await getAllConcerts()

  const concertsFormatted = {
    edges: concerts.map(c => ({ node: c })),
    totalCount: concerts.length,
  }

  return (
    <Layout concerts={allConcerts}>
      <main>
        <div className="container">
          <h2>
            {year}
            <ConcertCount concerts={concertsFormatted} />
          </h2>

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
