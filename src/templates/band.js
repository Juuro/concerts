import React from "react"
import PropTypes from 'prop-types'
import { graphql } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"

const Band = ({data, location, pageContext}) => {

  const concerts = data.allContentfulConcert

  return (
    <Layout>
      <SEO title="hi!" />
      <h1>{pageContext.name} ({concerts.totalCount})</h1>

      <ul>
        {concerts.edges.map(({ node }) => {
          return (
            <li key={node.id}>
              <span>{node.date}</span> im <span>{node.club}</span> in <span>{node.city.lon}</span>
            </li>
          )
        })}
      </ul>
    </Layout>
  )
}

Band.propTypes = {
  data: PropTypes.shape({
    allContentfulBand: PropTypes.shape({
      name: PropTypes.string.isRequired,
      slug: PropTypes.string.isRequired,
      url: PropTypes.string
    }),
  }).isRequired,
  location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
  }).isRequired,
}

export default Band

export const pageQuery = graphql`
  query BandQuery($slug: String!) {
    allContentfulConcert(sort: {order: DESC, fields: [date]}, filter: {bands: {elemMatch: {slug: {eq: $slug}}}}) {
      edges {
        node {
          ...ContentfulConcertFields
        }
      }
      totalCount
    }
  }
`

