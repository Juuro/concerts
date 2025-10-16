import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import ConcertCount from "../components/ConcertCount/concertCount"
import Seo from "../components/seo"

const Year = ({
  data: { allContentfulConcert: concerts },
  pageContext: { year, gt, lt },
}) => {
  return (
    <Layout>
      <main>
        <Seo title={year} />
        <h2>
          {year}
          <ConcertCount concerts={concerts} />
        </h2>

        <ul className="list-unstyled">
          {concerts.edges.map(({ node: concert }) => {
            return <ConcertCard key={concert.id} concert={concert} />
          })}
        </ul>
      </main>
    </Layout>
  )
}

Year.propTypes = {
  data: PropTypes.shape({
    allContentfulBand: PropTypes.shape({
      name: PropTypes.string.isRequired,
      slug: PropTypes.string.isRequired,
      url: PropTypes.string,
    }),
  }).isRequired,
  location: PropTypes.shape({
    pathname: PropTypes.string.isRequired,
  }).isRequired,
}

export default Year

export const pageQuery = graphql`
  query YearQuery($gt: Date!, $lt: Date!) {
    allContentfulConcert(
      sort: { date: DESC }
      filter: { date: { gte: $gt, lte: $lt } }
    ) {
      edges {
        node {
          ...ContentfulConcertFields
        }
      }
      totalCount
    }
  }
`
