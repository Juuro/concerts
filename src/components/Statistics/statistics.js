import React, { useEffect, useState } from "react"
import { useStaticQuery, graphql } from "gatsby"

import "./statistics.scss"

const Statistics = () => {
  const [yearCounts, setYearCounts] = useState({})
  const [mostConcerts, setMostConcerts] = useState(0)

  const yearCountEntries = Object.entries(yearCounts)

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
    console.log('useEffect1')
    const yearArray = dates.map(date => Object.values(date)).flat()

    for (const year of yearArray) {
      setYearCounts(yearCounts => {
        yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
        return yearCounts
      })
    }

    console.log('yearCounts', yearCounts)
  }, [dates, yearCounts])

  useEffect(() => {
    console.log('useEffect2')
    setMostConcerts(Math.max.apply(null, Object.values(yearCounts)))
  }, [yearCounts])

  return (
    <div className="card statistics">
      <h4>Stats</h4>
      <ul>
      {yearCountEntries.map(element => {
        // return 'möp'
        return (<li key={element[0]}>{element[0]}: {element[1]} ({calcPercentage(element[1])}%)</li>)
      })}
      </ul>
    </div>
  )
}

export default Statistics
