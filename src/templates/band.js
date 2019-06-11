import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"

class Band extends React.Component {
  constructor(props) {
    super(props)
    this.data = this.props.data
    this.location = this.props.location
    this.pageContext = this.props.pageContext
    this.concerts = this.data.allContentfulConcert
  }

  cityOrTown = concert => {
    if (concert.fields.geocoderAddressFields.town) {
      return concert.fields.geocoderAddressFields.town
    }
    return concert.fields.geocoderAddressFields.city
  }

  render() {
    return (
      <Layout>
        <SEO title="hi!" />
        <h1>
          {this.pageContext.name}{" "}
          <span className="badge bg-primary rounded-pill">
            {this.concerts.totalCount}
          </span>
        </h1>

        <ul className="list-group">
          {this.concerts.edges.map(({ node: concert }) => {
            return (
              <li key={concert.id} className="list-group-item">
                <span>{concert.date}</span> im <span>{concert.club}</span> in{" "}
                <span>{this.cityOrTown(concert)}</span>
              </li>
            )
          })}
        </ul>
      </Layout>
    )
  }
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
