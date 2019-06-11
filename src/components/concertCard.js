import PropTypes from "prop-types"
import React from "react"
import { Link } from "gatsby"

class ConcertCard extends React.Component {
  constructor(props) {
    super(props)
    this.concert = this.props.concert
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
      return this.concert.bands.map(band => {
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

  cityOrTown = () => {
    if (this.concert.fields.geocoderAddressFields.town) {
      return this.concert.fields.geocoderAddressFields.town
    }
    return this.concert.fields.geocoderAddressFields.city
  }

  render() {
    return (
      <li className="concert-card card mb-4 shadow-sm">
        <div className="card-header">
          <span>{this.concert.club}</span> in <span>{this.cityOrTown()}</span>
        </div>
        <div className="card-body">
          <h2 className="card-title">{this.heading()}</h2>
          <span>{this.concert.date}</span>
          <div className="bands">{this.bands()}</div>
        </div>
      </li>
    )
  }
}

ConcertCard.propTypes = {
  concert: PropTypes.object,
}

export default ConcertCard
