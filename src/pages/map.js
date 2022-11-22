import React, { useEffect, useRef } from 'react'
import PropTypes from "prop-types"
import { graphql } from "gatsby"
import 'leaflet/dist/leaflet.css'
import Leaflet from 'leaflet'
import markerSvg from 'leaflet/src/images/marker.svg'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

import Layout from "../components/layout"
import Seo from "../components/seo"

const MapPage = ({ data }) => {
  const siteTitle = data.site.siteMetadata.title
  const concerts = data.allContentfulConcert
  const map = useRef(null)
  const mapElement = useRef(null)

  const getYear = (dateInput) => {
    const date = new Date(dateInput)
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
    })
  }

  const CustomIcon = Leaflet.Icon.extend({
    options: {
      iconSize: [40, 40],
      shadowSize: [50, 64],
      shadowAnchor: [4, 62],
      popupAnchor: [0, -20]
    }
  })
  var markerIcon = new CustomIcon({ iconUrl: markerSvg })

  useEffect(() => {
    // eslint-disable-next-line no-magic-numbers
    map.current = Leaflet.map(mapElement.current).setView([51.163375, 10.447683], 6)

    const getDate = (dateInput) => {
      const date = new Date(dateInput)
      return date.toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }

    const getName = (node) => {
      if (node.isFestival) {
        return `${node.festival.name} ${getYear(node.date)}`
      }
      return node.bands[0].name
    }

    Leaflet.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: 'mapbox/outdoors-v11',
      tileSize: 512,
      zoomOffset: -1,
      accessToken: 'pk.eyJ1IjoianV1cm8iLCJhIjoiY2tkaGdoNzk0MDJ1YTJzb2V4anZ3NXk4bSJ9.1m7LQQaTf2W4R-IgKKGZCQ',
    }).addTo(map.current)


    const markers = Leaflet.markerClusterGroup()
    concerts.edges.forEach(({ node }) => {
      const marker = Leaflet.marker([node.city.lat, node.city.lon], { icon: markerIcon }).addTo(map.current)
      marker.bindPopup(`<strong>${getName(node)}</strong><br />${node.club} am ${getDate(node.date)}`)
      markers.addLayer(marker)
    })

    map.current.addLayer(markers)
  })

  return (
    <Layout>
      <Seo title={siteTitle} />
      <div className="mapid" ref={mapElement}></div>
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
