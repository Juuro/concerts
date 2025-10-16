import PropTypes from "prop-types"
import React from "react"
import { Link } from "gatsby"

import "./concertCard.scss"

const ConcertCard = ({ concert }) => {
  const heading = () => {
    if (concert.isFestival) {
      return concert.festival.name
    }
    return (
      <Link to={`/band/${concert.bands[0].slug}`}>{concert.bands[0].name}</Link>
    )
  }

  const bands = () => {
    const bands = [...concert.bands]
    // TODO: Badges as seperate (tag) component?
    if (concert.isFestival) {
      return bands.map((band) => {
        return (
          <Link
            to={`/band/${band.slug}`}
            key={band.id}
            className="badge bg-primary mr-2"
          >
            {band.name}
          </Link>
        )
      })
    } else {
      bands.shift()
      return bands.map((band) => {
        return (
          <Link
            to={`/band/${band.slug}`}
            key={band.id}
            className="badge bg-primary mr-2"
          >
            {band.name}
          </Link>
        )
      })
    }
  }

  const isInTheFuture = () => {
    if (concert.date > new Date().toISOString()) {
      return "future"
    }
    return ""
  }

  const getDate = () => {
    const date = new Date(concert.date)
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Get image URL - prefer Last.fm, fallback to Contentful
  const getImageUrl = () => {
    const lastfmImage =
      concert.bands[0].fields?.lastfm?.images?.large ||
      concert.bands[0].fields?.lastfm?.images?.extralarge
    const contentfulImage = concert.bands[0].image?.file.url

    return lastfmImage || contentfulImage
  }

  return (
    <li className={`concert-card card ${isInTheFuture()}`}>
      <div
        className="concert-card-image"
        style={{
          backgroundImage: `url(${getImageUrl()})`,
        }}
      ></div>
      <div className="concert-card-body">
        <h3 className="card-title">{heading()}</h3>
        <span>{getDate()}</span>
        {bands() && <div className="bands">{bands()}</div>}
      </div>
      <div className="concert-card-location">
        <div>
          <div className="club">{concert.club}</div>
          <div className="city">
            <Link
              to={`/city/${concert.fields.geocoderAddressFields._normalized_city?.toLowerCase()}`}
            >
              {concert.fields.geocoderAddressFields._normalized_city}
            </Link>
          </div>
        </div>
      </div>
    </li>
  )
}

ConcertCard.propTypes = {
  concert: PropTypes.object,
}

export default ConcertCard
