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
    }
    else {
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

  const cityTownVillage = () => {
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

  return (
    <li className={`concert-card card ${isInTheFuture()}`}>
      <div
        className="concert-card-image"
        style={{
          backgroundImage: `url(${concert.bands[0].image?.file.url})`,
        }}
      ></div>
      <div className="concert-card-body">
        <h2 className="card-title">{heading()}</h2>
        <span>{getDate()}</span>
        {bands() && <div className="bands">{bands()}</div>}
      </div>
      <div className="concert-card-location">
        <div>
          <div class="club">{concert.club}</div>
          <div class="city">{cityTownVillage()}</div>
        </div>
      </div>
    </li>
  )
}

ConcertCard.propTypes = {
  concert: PropTypes.object,
}

export default ConcertCard
