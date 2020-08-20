import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import SEO from "../components/seo"

const IndexPage = ({ data }) => {
  const siteTitle = data.site.siteMetadata.title
  const concerts = data.allContentfulConcert

  return (
    <Layout>
      <SEO title={siteTitle} />
      {concerts.totalCount}
      <ul className="list-unstyled">
        {concerts.edges.map(({ node }) => (
          <ConcertCard key={node.id} concert={node} />
        ))}
      </ul>
    </Layout>
  )
}

IndexPage.propTypes = {
  data: PropTypes.shape({
    allContentfulConcert: PropTypes.object.isRequired,
  }).isRequired,
}

export default IndexPage

export const pageQuery = graphql`
  query ConcertsIndexQuery {
    site {
      siteMetadata {
        title
      }
    }
    allContentfulConcert(sort: { order: DESC }) {
      edges {
        node {
          ...ContentfulConcertFields
        }
      }
      totalCount
    }
  }
`

// https://nominatim.openstreetmap.org/reverse?lon=8.54677330000004&lat=47.3663756&format=json
