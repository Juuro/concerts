"use client"

import React, { useMemo } from "react"
import { cityToSlug } from "../../utils/helpers"
import type { Concert, Band } from "../../types/concert"
import "./statisticsWidget.scss"
import BarChart from "../BarChart/barchart"

interface StatisticsWidgetProps {
  concerts?: Concert[]
  bands?: Band[]
}

const StatisticsWidget: React.FC<StatisticsWidgetProps> = ({
  concerts = [],
  bands = [],
}) => {
  const mostSeenBandsArray = useMemo(() => {
    if (bands.length === 0) return []
    return bands
      .filter((band) => band.concert && band.concert.length > 0)
      .map((band) => {
        const concertCount = band.concert!.filter(
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
  }, [bands])

  const mostConcertsOfOneBand = useMemo(() => {
    if (mostSeenBandsArray.length === 0) return 0
    return Math.max(...mostSeenBandsArray.map((band) => band.numberOfConcerts))
  }, [mostSeenBandsArray])

  const cityCountsObject = useMemo(() => {
    if (concerts.length === 0) return {}
    const cityArray = concerts
      .map((concert) => {
        if (new Date() < new Date(concert.date)) {
          return false
        }
        return concert.fields?.geocoderAddressFields?._normalized_city
      })
      .filter(
        (city): city is string => typeof city === "string" && city.length > 0
      )

    const cityCounts: Record<string, number> = {}
    for (const city of cityArray) {
      cityCounts[city] = cityCounts[city] ? cityCounts[city] + 1 : 1
    }
    return cityCounts
  }, [concerts])

  const yearCountsObject = useMemo(() => {
    if (concerts.length === 0) return {}
    const yearArray = concerts
      .filter((concert) => new Date() >= new Date(concert.date))
      .map((concert) => {
        const date = new Date(concert.date)
        const year = date.getFullYear()
        return Number.isFinite(year) ? year.toString() : undefined
      })

    const yearArrayFiltered = yearArray.filter(
      (year): year is string => typeof year === "string" && year.length > 0
    )

    const yearCounts: Record<string, number> = {}
    for (const year of yearArrayFiltered) {
      yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
    }
    return yearCounts
  }, [concerts])

  const mostConcerts = useMemo(() => {
    const values = Object.values(yearCountsObject)
    return values.length > 0 ? Math.max(...values) : 0
  }, [yearCountsObject])

  const mostCities = useMemo(() => {
    const values = Object.values(cityCountsObject)
    return values.length > 0 ? Math.max(...values) : 0
  }, [cityCountsObject])

  const yearCountEntries = Object.entries(yearCountsObject)
  const cityCountEntries = Object.entries(cityCountsObject)

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
          .map((city) => [city[0], city[1], cityToSlug(city[0])])}
        max={mostCities}
        title="most concerts per city"
        category="city"
      />
    </div>
  )
}

export default StatisticsWidget
