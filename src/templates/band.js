import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import Seo from "../components/seo"

const Band = ({ data: { allContentfulConcert: concerts }, pageContext: { name } }) => {
  return (
    <Layout>
      <main>
        <Seo title="hi!" />
        <h2>
          {name}{" "}
          <span className="badge bg-primary rounded-pill">
            {concerts.totalCount}
          </span>
        </h2>

        {concerts.edges.map(({ node: concert }) => {
          return (
            <ConcertCard key={concert.id} concert={concert} />
          )
        })}
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
