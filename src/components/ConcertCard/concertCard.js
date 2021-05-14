import PropTypes from "prop-types"
import React from "react"
import { Link } from "gatsby"

import "./concertCard.scss"

class ConcertCard extends React.Component {
  constructor(props) {
    super(props)
    this.concert = this.props.concert
    this.style = this.props.style
  }

  heading = () => {
    if (this.concert.isFestival) {
      return this.concert.festival.name
    }
    return (
      <Link to={`/band/${this.concert.bands[0].slug}`}>
        {this.concert.bands[0].name}
      </Link>
    )
  }

  bands = () => {
    if (this.concert.isFestival) {
      return this.concert.bands.map((band) => {
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
    return null
  }

  cityTownVillage = () => {
    switch (true) {
      case !!this.concert.fields.geocoderAddressFields.village:
        return this.concert.fields.geocoderAddressFields.village
      case !!this.concert.fields.geocoderAddressFields.town:
        return this.concert.fields.geocoderAddressFields.town
      case !!this.concert.fields.geocoderAddressFields.city:
      default:
        return this.concert.fields.geocoderAddressFields.city
    }
  }

  isInTheFuture = () => {
    if (this.concert.date > new Date().toISOString()) {
      return "future"
    }
    return ""
  }

  getDate = () => {
    const date = new Date(this.concert.date)
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  render = () => (
    <li className={`concert-card card ${this.isInTheFuture()}`}>
      <div
        className="concert-card-image"
        style={{
          backgroundImage:
            `url(${this.concert.bands[0].image?.file.url})`,
        }}
      ></div>
      <div className="concert-card-body">
        <h2 className="card-title">{this.heading()}</h2>
        <span>{this.getDate()}</span>
        {this.bands() && <div className="bands">{this.bands()}</div>}
      </div>
      <div className="concert-card-map">
        <span>{this.concert.club}</span> in{' '}
        <span>{this.cityTownVillage()}</span>
      </div>
    </li>
  )
}

ConcertCard.propTypes = {
  concert: PropTypes.object,
}

export default ConcertCard
