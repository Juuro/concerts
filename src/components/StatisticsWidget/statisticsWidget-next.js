'use client'

import React, { useEffect, useState } from 'react'

import './statisticsWidget.scss'
import BarChart from '../BarChart/barchart-next'

const StatisticsWidget = ({ concerts = [], bands = [] }) => {
  const [yearCountsObject, setYearCountsObject] = useState({})
  const [cityCountsObject, setCityCountsObject] = useState({})
  const [mostConcerts, setMostConcerts] = useState(0)
  const [mostCities, setMostCities] = useState(0)
  const [mostSeenBandsArray, setMostSeenBandsArray] = useState([])
  const [mostConcertsOfOneBand, setMostConcertsOfOneBand] = useState(0)

  const yearCountEntries = Object.entries(yearCountsObject)
  const cityCountEntries = Object.entries(cityCountsObject)

  useEffect(() => {
    if (bands.length === 0) return

    const bandsArray = bands
      .filter((band) => band.concert && band.concert.length > 0)
      .map((band) => {
        const concertCount = band.concert.filter(
          (concert) => new Date() > new Date(concert.date)
        ).length

        return {
          id: band.id,
          slug: band.slug,
          name: band.name,
          numberOfConcerts: concertCount,
        }
      })
      .sort((a, b) => b.numberOfConcerts - a.numberOfConcerts)
      .slice(0, 5)
    setMostSeenBandsArray(bandsArray)
  }, [bands])

  useEffect(() => {
    if (mostSeenBandsArray.length > 0) {
      setMostConcertsOfOneBand(
        Math.max.apply(
          null,
          mostSeenBandsArray.map((band) => band.numberOfConcerts)
        )
      )
    }
  }, [mostSeenBandsArray])

  useEffect(() => {
    if (concerts.length === 0) return

    const cityArray = concerts
      .map((concert) => {
        if (new Date() < new Date(concert.date)) {
          return false
        }

        return concert.fields?.geocoderAddressFields?._normalized_city
      })
      .filter((city) => city !== false && city !== null)

    if (Object.entries(cityCountsObject).length === 0 && cityArray.length > 0) {
      const cityCounts = {}
      for (const city of cityArray) {
        if (!city) {
          continue
        }
        cityCounts[city] = cityCounts[city] ? cityCounts[city] + 1 : 1
      }
      setCityCountsObject(cityCounts)
    }
  }, [concerts, cityCountsObject])

  useEffect(() => {
    if (concerts.length === 0) return

    const yearArray = concerts
      .filter((concert) => {
        if (new Date() < new Date(concert.date)) {
          return false
        }
        return true
      })
      .map((concert) => {
        const date = new Date(concert.date)
        return date.getFullYear().toString()
      })
      .filter((year) => year !== false)

    if (Object.entries(yearCountsObject).length === 0 && yearArray.length > 0) {
      const yearCounts = {}
      for (const year of yearArray) {
        yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
      }
      setYearCountsObject(yearCounts)
    }
  }, [concerts, yearCountsObject])

  useEffect(() => {
    if (Object.values(yearCountsObject).length > 0) {
      setMostConcerts(Math.max.apply(null, Object.values(yearCountsObject)))
    }
  }, [yearCountsObject])

  useEffect(() => {
    if (Object.values(cityCountsObject).length > 0) {
      setMostCities(Math.max.apply(null, Object.values(cityCountsObject)))
    }
  }, [cityCountsObject])

  return (
    <div className="card statistics-widget">
      <BarChart
        data={yearCountEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map((year) => [year[0], year[1], year[0]])}
        max={mostConcerts}
        title="most concerts per year"
        category="year"
      />
      <BarChart
        data={mostSeenBandsArray.map((band) => [
          band.name,
          band.numberOfConcerts,
          band.slug,
        ])}
        max={mostConcertsOfOneBand}
        title="most concerts per band"
        category="band"
      />
      <BarChart
        data={cityCountEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map((city) => [
            city[0],
            city[1],
            city[0]?.toLowerCase().replace(/\s+/g, '-'),
          ])}
        max={mostCities}
        title="most concerts per city"
        category="city"
      />
    </div>
  )
}

export default StatisticsWidget
