import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import ConcertCount from "../components/ConcertCount/concertCount"
import Seo from "../components/seo"

const Band = ({ data: { allContentfulConcert: concerts }, pageContext: { name } }) => {
  return (
    <Layout>
      <main>
        <Seo title={name} />
        <h2>
          {name}
          <ConcertCount concerts={concerts} />
        </h2>

        <ul className="list-unstyled">
          {concerts.edges.map(({ node: concert }) => {
            return (
              <ConcertCard key={concert.id} concert={concert} />
            )
          })}
        </ul>
      </main>
    </Layout>
  )
}

Band.propTypes = {
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

export default Band

export const pageQuery = graphql`
  query BandQuery($slug: String!) {
    allContentfulConcert(
      sort: { order: DESC, fields: [date] }
      filter: { bands: { elemMatch: { slug: { eq: $slug } } } }
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
