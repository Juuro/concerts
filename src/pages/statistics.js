import React from "react"
import { useStaticQuery, graphql } from "gatsby"
import { Link } from "gatsby"

import Layout from "../components/layout"
import Seo from "../components/seo"
import BarChart from "../components/BarChart/barchart"
import {
  calculateYearCounts,
  calculateCityCounts,
  calculateMostSeenBands,
  calculateLocationCounts,
  calculateFestivalsVsConcerts,
  calculateMostVisitedFestivals,
  calculateCostPerYear,
  calculateCostPerBand,
} from "../utils/statisticsCalculations"

import "./statistics.scss"

const StatisticsPage = () => {
  const {
    allContentfulConcert: { nodes: concerts },
    allContentfulBand: { edges: bands },
  } = useStaticQuery(graphql`
    query StatisticsQuery {
      allContentfulConcert {
        nodes {
          year: date(formatString: "YYYY")
          date
          club
          isFestival
          cost
          festival {
            name
            url
          }
          bands {
            id
            name
            slug
          }
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

  // Calculate statistics
  const yearCounts = calculateYearCounts(concerts)
  const cityCounts = calculateCityCounts(concerts)
  const mostSeenBands = calculateMostSeenBands(bands)
  const locationCounts = calculateLocationCounts(concerts)
  const festivalsVsConcerts = calculateFestivalsVsConcerts(concerts)
  const festivalCounts = calculateMostVisitedFestivals(concerts)
  const costPerYear = calculateCostPerYear(concerts)
  const costPerBand = calculateCostPerBand(concerts)

  // Sort and prepare data for charts
  const yearCountEntries = Object.entries(yearCounts).sort(
    (a, b) => b[1] - a[1]
  )
  const cityCountEntries = Object.entries(cityCounts).sort(
    (a, b) => b[1] - a[1]
  )
  const locationCountEntries = Object.entries(locationCounts).sort(
    (a, b) => b[1] - a[1]
  )
  const festivalCountEntries = Object.entries(festivalCounts).sort(
    (a, b) => b[1] - a[1]
  )
  const costPerYearEntries = Object.entries(costPerYear).sort((a, b) =>
    b[0].localeCompare(a[0])
  )
  const costPerBandEntries = Object.entries(costPerBand).sort(
    (a, b) => b[1] - a[1]
  )

  const maxConcerts = Math.max(...Object.values(yearCounts))
  const maxCities = Math.max(...Object.values(cityCounts))
  const maxBandConcerts = mostSeenBands[0]?.numberOfConcerts || 0
  const maxLocations = Math.max(...Object.values(locationCounts))
  const maxFestivals = Math.max(...Object.values(festivalCounts))
  const maxCostPerYear = Math.max(...Object.values(costPerYear))
  const maxCostPerBand = Math.max(...Object.values(costPerBand))

  return (
    <Layout>
      <main>
        <div className="container">
          <Seo title="Statistics" />
          <h2>Statistics</h2>

          <div className="statistics-page">
            {/* Concerts per Year */}
            <div className="card statistics-section">
              <BarChart
                data={yearCountEntries.map((year) => [
                  year[0],
                  year[1],
                  year[0],
                ])}
                max={maxConcerts}
                title="all concerts per year"
                category="year"
              />
            </div>

            {/* Most Seen Bands */}
            <div className="card statistics-section">
              <BarChart
                data={mostSeenBands.map((band) => [
                  band.name,
                  band.numberOfConcerts,
                  band.slug,
                ])}
                max={maxBandConcerts}
                title="all concerts per band"
                category="band"
              />
            </div>

            {/* Most Visited Cities */}
            <div className="card statistics-section">
              <BarChart
                data={cityCountEntries.map((city) => [
                  city[0],
                  city[1],
                  city[0]?.toLowerCase().replace("/s+/", "-"),
                ])}
                max={maxCities}
                title="all concerts per city"
                category="city"
              />
            </div>

            {/* Most Visited Locations */}
            <div className="card statistics-section">
              <BarChart
                data={locationCountEntries.map((location) => [
                  location[0],
                  location[1],
                  null,
                ])}
                max={maxLocations}
                title="all concerts per location (club/venue)"
                category="location"
              />
            </div>

            {/* Festivals vs Concerts */}
            <div className="card statistics-section">
              <h4>Festivals vs Concerts</h4>
              <div className="festivals-vs-concerts">
                <div className="stat-item">
                  <span className="stat-label">Festivals:</span>
                  <span className="stat-value">
                    {festivalsVsConcerts.festivals}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Concerts:</span>
                  <span className="stat-value">
                    {festivalsVsConcerts.concerts}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total:</span>
                  <span className="stat-value">
                    {festivalsVsConcerts.total}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Festival Percentage:</span>
                  <span className="stat-value">
                    {festivalsVsConcerts.total > 0
                      ? Math.round(
                          (festivalsVsConcerts.festivals /
                            festivalsVsConcerts.total) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Most Visited Festivals */}
            {festivalCountEntries.length > 0 && (
              <div className="card statistics-section">
                <BarChart
                  data={festivalCountEntries.map((festival) => [
                    festival[0],
                    festival[1],
                    null,
                  ])}
                  max={maxFestivals}
                  title="most visited festivals"
                  category="festival"
                />
              </div>
            )}

            {/* Cost Per Year */}
            {costPerYearEntries.length > 0 && (
              <div className="card statistics-section">
                <h4>Cost per Year (€)</h4>
                <ul className="cost-list">
                  {costPerYearEntries.map(([year, cost]) => (
                    <li key={year}>
                      <Link to={`/year/${year}`}>
                        <strong>{year}:</strong> €{cost.toFixed(2)}
                      </Link>
                    </li>
                  ))}
                  <li className="total">
                    <strong>Total:</strong> €
                    {costPerYearEntries
                      .reduce((sum, [, cost]) => sum + cost, 0)
                      .toFixed(2)}
                  </li>
                </ul>
              </div>
            )}

            {/* Most Money Spent Per Band */}
            {costPerBandEntries.length > 0 && (
              <div className="card statistics-section">
                <h4>Most Money Spent per Band (€)</h4>
                <ul className="cost-list">
                  {costPerBandEntries.slice(0, 20).map(([bandName, cost]) => (
                    <li key={bandName}>
                      <strong>{bandName}:</strong> €{cost.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </Layout>
  )
}

export default StatisticsPage
