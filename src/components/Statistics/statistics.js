import PropTypes from "prop-types"
import React, { useEffect } from "react"
import { useStaticQuery, graphql } from "gatsby"

import "./statistics.scss"

const Statistics = () => {
  const nodes = useStaticQuery(
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
    console.log('nodes')
  });

  return (
    <div className="card statistics">
      <h4>Stats</h4>
    </div>
  )
}

export default Statistics
