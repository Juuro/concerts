import React, { useEffect, useState } from "react"
import { useStaticQuery, graphql } from "gatsby"

import "./statistics.scss"

const Statistics = () => {
  const [yearCounts, setYearCounts] = useState({})
  const [mostConcerts, setMostConcerts] = useState(0)

  const { allContentfulConcert: { nodes: dates } } = useStaticQuery(
    graphql`
      query MyQuery {
        allContentfulConcert {
          nodes {
            date(formatString: "YYYY")
          }
        }
      }
    `
  )

  const calcPercentage = absolute => {
    return Math.round(absolute * 100 / mostConcerts)
  }

  useEffect(() => {
    const yearArray = dates.map(date => Object.values(date)).flat()

    for (const year of yearArray) {
      setYearCounts(yearCounts => {
        yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
        return yearCounts
      })
    }
  }, [dates, yearCounts])

  useEffect(() => {
    setMostConcerts(Math.max.apply(null, Object.values(yearCounts)))
  }, [yearCounts])

  return (
    <div className="card statistics">
      <h4>Stats</h4>
      <ul>
      {Object.entries(yearCounts).map(element => {
        return (<li>{element[0]}: {calcPercentage(element[1])}</li>)
      })}
      </ul>
    </div>
  )
}

export default Statistics
