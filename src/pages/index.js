import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"
import { Map, Marker } from 'react-mapkit'

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import SEO from "../components/seo"

const IndexPage = ({ data }) => {
  const siteTitle = data.site.siteMetadata.title
  const concerts = data.allContentfulConcert
  // const { map } = useMap()

  const getDate = (dateInput) => {
    const date = new Date(dateInput)
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getYear = (dateInput) => {
    const date = new Date(dateInput)
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
    })
  }

  const getName = (node) => {
    if (node.isFestival) {
      return `${node.festival.name} ${getYear(node.date)}`
    }
    return node.bands[0].name
  }

  return (
    <Layout>
      <SEO title={siteTitle} />
      {concerts.totalCount}

      <h2>Map:</h2>
      
      <div className="map-box">
        <Map center={[50.8, 11]} cameraDistance="1500000">
          {concerts.edges.map(({ node }) => (
            <Marker key={node.id} latitude={node.city.lat} longitude={node.city.lon} title={getName(node)} subtitle={getDate(node.date)} />
          ))}
        </Map>
      </div>
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
    allContentfulConcert(sort: { order: DESC, fields: [date] }) {
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
