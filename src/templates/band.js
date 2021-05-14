import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import Seo from "../components/seo"

const Band = ({ data: {allContentfulConcert: concerts}, pageContext: {name} }) => {
  const cityTownVillage = (concert) => {
    switch (true) {
      case !!concert.fields.geocoderAddressFields.village:
        return concert.fields.geocoderAddressFields.village
      case !!concert.fields.geocoderAddressFields.town:
        return concert.fields.geocoderAddressFields.town
      case !!concert.fields.geocoderAddressFields.city:
      default:
        return concert.fields.geocoderAddressFields.city
    }
  }

  return (
    <Layout>
      <main>
        <Seo title="hi!" />
        <h1>
          {name}{" "}
          <span className="badge bg-primary rounded-pill">
            {concerts.totalCount}
          </span>
        </h1>

        <ul className="list-group">
          {concerts.edges.map(({ node: concert }) => {
            return (
              <li key={concert.id} className="list-group-item">
                <span>{concert.date}</span> im <span>{concert.club}</span> in{" "}
                <span>{cityTownVillage(concert)}</span>
              </li>
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
