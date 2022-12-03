import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import Seo from "../components/seo"

const IndexPage = ({ data }) => {
  const siteTitle = data.site.siteMetadata.title
  const concerts = data.allContentfulConcert
 
  return (
    <Layout>
      <main>
        <div className="container">
          <Seo title={siteTitle} />
          <ul className="list-unstyled">
            {concerts.edges.map(({ node }) => (
              <ConcertCard key={node.id} concert={node} />
            ))}
          </ul>
        </div>
      </main>
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
    allContentfulConcert(sort: {date: DESC}) {
      edges {
        node {
          ...ContentfulConcertFields
        }
      }
      totalCount
    }
  }
`
