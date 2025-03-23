import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import ConcertCount from "../components/ConcertCount/concertCount"
import Seo from "../components/seo"

const City = ({
  data: { allContentfulConcert: concerts },
  pageContext: { name },
}) => {
  console.log("city name", name, concerts)

  return (
    <Layout>
      <main>
        <Seo title={name} />
        <h2>
          {name}
          <ConcertCount concerts={concerts} />
        </h2>

        <ul className="list-unstyled">
          {concerts.edges.map(({ node: concert }) => {
            return <ConcertCard key={concert.id} concert={concert} />
          })}
        </ul>
      </main>
    </Layout>
  )
}

City.propTypes = {
  data: PropTypes.shape({
    allContentfulBand: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  }).isRequired,
  location: PropTypes.shape({
    pathname: PropTypes.string.isRequired,
  }).isRequired,
}

export default City

export const pageQuery = graphql`
  query CityQuery($name: String!) {
    allContentfulConcert(
      sort: { date: DESC }
      filter: {
        fields: { geocoderAddressFields: { _normalized_city: { eq: $name } } }
      }
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
