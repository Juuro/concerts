import React, { useEffect, useState } from "react"
import { useStaticQuery, graphql } from "gatsby"

import "./statisticsWidget.scss"
import BarChart from "../BarChart/barchart"

const StatisticsWidget = () => {
  const [yearCountsObject, setYearCountsObject] = useState({})
  const [cityCountsObject, setCityCountsObject] = useState({})
  const [mostConcerts, setMostConcerts] = useState(0)
  const [mostCities, setMostCities] = useState(0)
  const [mostSeenBandsArray, setMostSeenBandsArray] = useState([])
  const [mostConcertsOfOneBand, setMostConcertsOfOneBand] = useState(0)

  const yearCountEntries = Object.entries(yearCountsObject)
  const cityCountEntries = Object.entries(cityCountsObject)

  const { allContentfulConcert: { nodes: dates }, allContentfulBand: { edges: bands } } = useStaticQuery(
    graphql`
      query MyQuery {
        allContentfulConcert {
          nodes {
            years: date(formatString: "YYYY")
            date
            fields {
              geocoderAddressFields {
                city
                town
                village
              }
            }
          }
        }
        allContentfulBand {
          edges {
            node {
              name
              slug
              id
              concert {
                id
                date
              }
            }
          }
        }
      }
    `
  )

  useEffect(() => {
    const bandsArray = bands.filter(elem => !!elem.node.concert)
      .map(elem => {
        const concertCount = elem.node.concert.filter(concert => new Date() > new Date(concert.date)).length

        return {
          id: elem.node.id,
          slug: elem.node.slug,
          name: elem.node.name,
          numberOfConcerts: concertCount
        }
      })
      .sort((a, b) => b.numberOfConcerts - a.numberOfConcerts)
      .slice(0, 5)
    setMostSeenBandsArray(bandsArray)
  }, [bands])

  useEffect(() => {
    setMostConcertsOfOneBand(Math.max.apply(null, mostSeenBandsArray.map(band => band.numberOfConcerts)))
  }, [mostSeenBandsArray])

  useEffect(() => {
    const cityArray = dates.map(date => {
      if (new Date() < new Date(date.date)) {
        return false
      }
      switch (true) {
        case !!date.fields.geocoderAddressFields.village:
          return date.fields.geocoderAddressFields.village
        case !!date.fields.geocoderAddressFields.town:
          return date.fields.geocoderAddressFields.town
        case !!date.fields.geocoderAddressFields.city:
        default:
          return date.fields.geocoderAddressFields.city
      }
    }).filter((city) => city !== false)

    if (Object.entries(cityCountsObject).length === 0) {
      const cityCounts = {}
      for (const city of cityArray) {
        cityCounts[city] = cityCounts[city] ? cityCounts[city] + 1 : 1
      }
      setCityCountsObject(cityCounts)
    }
  }, [dates, cityCountsObject])

  useEffect(() => {
    const yearArray = dates.map(date => {
      if (new Date() < new Date(date.date)) {
        return false
      }
      return date.years
    }).filter((year) => year !== false).flat()

    if (Object.entries(yearCountsObject).length === 0) {
      const yearCounts = {}
      for (const year of yearArray) {
        yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
      }
      setYearCountsObject(yearCounts)
    }
  }, [dates, yearCountsObject])

  useEffect(() => {
    setMostConcerts(Math.max.apply(null, Object.values(yearCountsObject)))
  }, [yearCountsObject])

  useEffect(() => {
    setMostCities(Math.max.apply(null, Object.values(cityCountsObject)))
  }, [cityCountsObject])

  return (
    <React.StrictMode>
      <div className="card statistics-widget">
        <BarChart data={yearCountEntries.sort((a, b) => b[1] - a[1]).slice(0, 5)} max={mostConcerts} title="most concerts per year" category="year" />
        <BarChart data={mostSeenBandsArray.map(element => [element.name, element.numberOfConcerts, element.slug])} max={mostConcertsOfOneBand} title="most concerts per band" category="band" />
        <BarChart data={cityCountEntries.sort((a, b) => b[1] - a[1]).slice(0, 5)} max={mostCities} title="most concerts per city" category="city" />
      </div>
    </React.StrictMode>
  )
}

export default StatisticsWidget
