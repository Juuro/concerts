import React, { useEffect, useState } from "react"
import { useStaticQuery, graphql, Link } from "gatsby"

import "./statistics.scss"

const Statistics = () => {
  const [yearCountsObject, setYearCountsObject] = useState({})
  const [mostConcerts, setMostConcerts] = useState(0)
  const [mostSeenBandsArray, setMostSeenBandsArray] = useState([])
  const [mostConcertsOfOneBand, setMostConcertsOfOneBand] = useState(0)

  const yearCountEntries = Object.entries(yearCountsObject)

  const { allContentfulConcert: { nodes: dates }, allContentfulBand: { edges: bands } } = useStaticQuery(
    graphql`
      query MyQuery {
        allContentfulConcert {
          nodes {
            date(formatString: "YYYY")
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
    const yearArray = dates.map(date => Object.values(date)).flat()

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

  // TODO: Get the bar chart design right.
  return (
    <React.StrictMode>
      <div className="card statistics">
        <h4>Stats</h4>
        <div className="stats-box">
          <div>
            <ul>
              {yearCountEntries.sort((a, b) => b[1] - a[1]).slice(0, 5).map(element => {
                return (<li style={{ width: calcPercentage(element[1], mostConcerts) + '%' }} key={element[0]} title={element[1]}>{element[0]} <strong>{element[1]}</strong></li>)
              })}
            </ul>
          </div>
          <div>
            <ul>
              {mostSeenBandsArray.map(element => {
                const key = `${element.id}${element.numberOfConcerts}`
                return (<li style={{ width: calcPercentage(element.numberOfConcerts, mostConcertsOfOneBand) + '%' }} key={key}><Link to={`/band/${element.slug}`}>{element.name} <strong>{element.numberOfConcerts}</strong></Link></li>)
              })}
            </ul>
          </div>
          <div>ho</div>
        </div>
      </div>
    </React.StrictMode>
  )
}

export default Statistics
