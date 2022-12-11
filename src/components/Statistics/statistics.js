import React, { useEffect, useState } from "react"
import { useStaticQuery, graphql } from "gatsby"

import "./statistics.scss"

const Statistics = () => {
  const [yearCounts, setYearCounts] = useState({})

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

  useEffect(() => {
    const yearArray = dates.map(date => Object.values(date)).flat()

    for (const year of yearArray) {
      setYearCounts(yearCounts => {
        yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
        return yearCounts
      })
    }

    console.log("yearCounts", yearCounts)
  }, [dates, yearCounts])

  return (
    <div className="card statistics">
      <h4>Stats</h4>
      {yearCounts[2007]}
    </div>
  )
}

export default Statistics
