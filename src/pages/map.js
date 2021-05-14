import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"
import { Map, Marker, MapkitProvider } from "react-mapkit"

import Layout from "../components/layout"
import SEO from "../components/seo"

const MapPage = ({ data }) => {
  const siteTitle = data.site.siteMetadata.title
  const concerts = data.allContentfulConcert

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
      <div className="map-box">
        <MapkitProvider
          tokenOrCallback={
            "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjZKMzc1SlBIM0sifQ.eyJpYXQiOjE2MTkzNTU3MTUuMDQxLCJpc3MiOiJBOEw5VFJTWkNSIn0.Z9Fv2cs3vfHhGJOoVIj2e1vonKZBXh_GDfdLXCLJ3Wxbidj8F2W0c9JOCFoHRAEHV85fPtysX1DqvMPRD-_P9g"
          }
        >
          <Map center={[50.8, 11]} cameraDistance="1500000">
            {concerts.edges.map(({ node }) => (
              <Marker
                key={node.id}
                latitude={node.city.lat}
                longitude={node.city.lon}
                title={getName(node)}
                subtitle={getDate(node.date)}
              />
            ))}
          </Map>
        </MapkitProvider>
      </div>
    </Layout>
  )
}

MapPage.propTypes = {
  data: PropTypes.shape({
    allContentfulConcert: PropTypes.object.isRequired,
  }).isRequired,
}

export default MapPage

export const pageQuery = graphql`
  query ConcertsMapQuery {
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
