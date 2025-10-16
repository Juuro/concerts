import React, { useEffect, useState } from "react"
import { useStaticQuery, graphql, Link } from "gatsby"

import "./statisticsWidget.scss"
import BarChart from "../BarChart/barchart"
import {
  calculateYearCounts,
  calculateCityCounts,
  calculateMostSeenBands,
} from "../../utils/statisticsCalculations"

const StatisticsWidget = () => {
  const [yearCountsObject, setYearCountsObject] = useState({})
  const [cityCountsObject, setCityCountsObject] = useState({})
  const [mostConcerts, setMostConcerts] = useState(0)
  const [mostCities, setMostCities] = useState(0)
  const [mostSeenBandsArray, setMostSeenBandsArray] = useState([])
  const [mostConcertsOfOneBand, setMostConcertsOfOneBand] = useState(0)

  const yearCountEntries = Object.entries(yearCountsObject)
  const cityCountEntries = Object.entries(cityCountsObject)

  const {
    allContentfulConcert: { nodes: dates },
    allContentfulBand: { edges: bands },
  } = useStaticQuery(graphql`
    query MyQuery {
      allContentfulConcert {
        nodes {
          year: date(formatString: "YYYY")
          date
          fields {
            geocoderAddressFields {
              _normalized_city
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
  `)

  useEffect(() => {
    const bandsArray = calculateMostSeenBands(bands).slice(0, 5)
    setMostSeenBandsArray(bandsArray)
  }, [bands])

  useEffect(() => {
    setMostConcertsOfOneBand(
      Math.max.apply(
        null,
        mostSeenBandsArray.map((band) => band.numberOfConcerts)
      )
    )
  }, [mostSeenBandsArray])

  useEffect(() => {
    const cityCounts = calculateCityCounts(dates)
    if (Object.entries(cityCountsObject).length === 0) {
      setCityCountsObject(cityCounts)
    }
  }, [dates, cityCountsObject])

  useEffect(() => {
    const yearCounts = calculateYearCounts(dates)
    if (Object.entries(yearCountsObject).length === 0) {
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
              city[0]?.toLowerCase().replace("/s+/", "-"),
            ])}
          max={mostCities}
          title="most concerts per city"
          category="city"
        />
        <div className="statistics-widget-footer">
          <Link to="/statistics" className="view-all-link">
            View all statistics →
          </Link>
        </div>
      </div>
    </React.StrictMode>
  )
}

export default StatisticsWidget
