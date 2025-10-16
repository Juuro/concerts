import React from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import ConcertCard from "../components/ConcertCard/concertCard"
import ConcertCount from "../components/ConcertCount/concertCount"
import Seo from "../components/seo"

const Band = ({
  data: { allContentfulConcert: concerts },
  pageContext: { name, lastfm },
}) => {
  return (
    <Layout>
      <main>
        <Seo title={name} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "20px",
          }}
        >
          {lastfm?.images?.large && (
            <img
              src={lastfm.images.large}
              alt={name}
              style={{
                width: "150px",
                height: "150px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />
          )}
          <div>
            <h2>
              {name}
              <ConcertCount concerts={concerts} />
            </h2>
            {lastfm?.genres && lastfm.genres.length > 0 && (
              <div style={{ marginTop: "10px" }}>
                <strong>Genres: </strong>
                {lastfm.genres.slice(0, 5).map((genre, index) => (
                  <span
                    key={genre}
                    className="badge bg-secondary"
                    style={{ marginRight: "5px" }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <ul className="list-unstyled">
          {concerts.edges.map(({ node: concert }) => {
            return <ConcertCard key={concert.id} concert={concert} />
          })}
        </ul>
      </main>
    </Layout>
  )
}

Band.propTypes = {
  data: PropTypes.shape({
    allContentfulConcert: PropTypes.object.isRequired,
  }).isRequired,
  pageContext: PropTypes.shape({
    name: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    lastfm: PropTypes.object,
  }).isRequired,
}

export default Band

export const pageQuery = graphql`
  query BandQuery($slug: String!) {
    allContentfulConcert(
      sort: { date: DESC }
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
