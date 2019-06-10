import React from "react"
import PropTypes from 'prop-types'
import { Link, graphql } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"

const IndexPage = ({data}) => {
  const siteTitle = data.site.siteMetadata.title
  const concerts = data.allContentfulConcert
  
  return (
    <Layout>
    <SEO title={siteTitle} />
    {concerts.totalCount}
    <ul>
    {concerts.edges.map(({ node }) => {
      return (
        <li key={node.id}>
        <h2><Link to={`/band/${node.band.slug}`}>{node.band.name}</Link></h2>
        <span>{node.date}</span> im <span>{node.club}</span> in <span>{node.city.lon}</span>
        </li>
        )
      })}
      </ul>
      </Layout>
      )
    }
    
    IndexPage.propTypes = {
      data: PropTypes.shape({
        allContentfulConcert: PropTypes.object.isRequired
      }).isRequired
    }
    
    export default IndexPage
    
    export const pageQuery = graphql`
    query ConcertsIndexQuery {
      site {
        siteMetadata {
          title
        }
      }
      allContentfulConcert(sort: {order: DESC, fields: [date]}) {
        edges {
          node {
            ...ContentfulConcertFields
          }
        }
        totalCount
      }
    }
    `
    
    