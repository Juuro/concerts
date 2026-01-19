import React from 'react'
import Layout from '../../../src/components/layout-client'
import ConcertCard from '../../../src/components/ConcertCard/concertCard-next'
import ConcertCount from '../../../src/components/ConcertCount/concertCount'
import { getAllCities, getConcertsByCity, getAllConcerts } from '../../../src/utils/data'

export async function generateStaticParams() {
  const cities = await getAllCities()
  return cities.map((city) => ({
    slug: city.toLowerCase().replace(/\s+/g, '-'),
  }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const cities = await getAllCities()
  const city = cities.find((c) => c.toLowerCase().replace(/\s+/g, '-') === slug)
  
  return {
    title: `${city || slug} | Concerts`,
  }
}

export default async function CityPage({ params }) {
  const { slug } = await params
  const cities = await getAllCities()
  const cityName = cities.find((c) => c.toLowerCase().replace(/\s+/g, '-') === slug)
  const concerts = cityName ? await getConcertsByCity(cityName) : []
  const allConcerts = await getAllConcerts()

  if (!cityName) {
    return <div>City not found</div>
  }

  const concertsFormatted = {
    edges: concerts.map(c => ({ node: c })),
    totalCount: concerts.length,
  }

  return (
    <Layout concerts={allConcerts}>
      <main>
        <div className="container">
          <h2>
            {cityName}
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
