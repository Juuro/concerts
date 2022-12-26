import React, { useEffect, useState } from "react"
import { useStaticQuery, graphql, Link } from "gatsby"

import "./statistics.scss"

const Statistics = () => {
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
              }
            }
          }
        }
      }
    `
  )

  const calcPercentage = (absolute, dings) => {
    if (dings >= 0) {
      const percentage = Math.round(absolute * 100 / dings)
      return percentage
    }
  }

  useEffect(() => {
    const bandsArray = bands.filter(elem => !!elem.node.concert)
      .map(elem => {
        return {
          id: elem.node.id,
          slug: elem.node.slug,
          name: elem.node.name,
          numberOfConcerts: elem.node.concert.length
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
    const yearArray = dates.map(date => {
      if (new Date < new Date(date.date)) {
        return
      }
      return date.years
    }).flat()
    
    const cityArray = dates.map(date => {
      if (new Date < new Date(date.date)) {
        return
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
    })

    if (Object.entries(yearCountsObject).length === 0) {
      const yearCounts = {}
      for (const year of yearArray) {
        yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
      }
      setYearCountsObject(yearCounts)
    }

    if (Object.entries(cityCountsObject).length === 0) {
      const cityCounts = {}
      for (const city of cityArray) {
        cityCounts[city] = cityCounts[city] ? cityCounts[city] + 1 : 1
      }
      setCityCountsObject(cityCounts)
    }
  }, [dates, yearCountsObject, cityCountsObject])

  useEffect(() => {
    setMostConcerts(Math.max.apply(null, Object.values(yearCountsObject)))
  }, [yearCountsObject])

  useEffect(() => {
    setMostCities(Math.max.apply(null, Object.values(cityCountsObject)))
  }, [cityCountsObject])

  // TODO: Split into three components: Statistics (or some kind of box with three columns, or just a div with display: flex), MostSeenBands, MostConcertsPerYear. The latter should also be usable on the full Statstics page and have more than just five entries.
  return (
    <React.StrictMode>
      <div className="card statistics">
        <div className="stats-box">
          <div>
            <ul>
              {yearCountEntries.sort((a, b) => b[1] - a[1]).slice(0, 5).map(element => {
                return (<li style={{ width: calcPercentage(element[1], mostConcerts) + '%' }} key={element[0]} title={element[1]}><strong>{element[1]}</strong> {element[0]}</li>)
              })}
            </ul>
          </div>
          <div>
            <ul>
              {mostSeenBandsArray.map(element => {
                const key = `${element.id}${element.numberOfConcerts}`
                return (<li style={{ width: calcPercentage(element.numberOfConcerts, mostConcertsOfOneBand) + '%' }} key={key}><Link to={`/band/${element.slug}`}><strong>{element.numberOfConcerts}</strong> {element.name}</Link></li>)
              })}
            </ul>
          </div>
          <div>
            <ul>
              {cityCountEntries.sort((a, b) => b[1] - a[1]).slice(0, 5).map(element => {
                return (<li style={{ width: calcPercentage(element[1], mostCities) + '%' }} key={element[0]} title={element[1]}><strong>{element[1]}</strong> {element[0]}</li>)
              })}
            </ul>
          </div>
        </div>
      </div>
    </React.StrictMode>
  )
}

export default Statistics
