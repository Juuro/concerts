import PropTypes from "prop-types"
import React from "react"
import { Link } from "gatsby"

class ConcertCard extends React.Component {
  constructor(props) {
    super(props)
    this.concert = this.props.concert
    console.log('concert: ', this.concert)
  }

  heading = () => {
    if (this.concert.isFestival) {
      return this.concert.festival.name
    }
    return <Link to={`band/${this.concert.bands[0].slug}`}>{this.concert.bands[0].name}</Link>
  }

  bands = () => {
    if (this.concert.isFestival) {
      return (
        this.concert.bands.map(band => {
          return (
            <Link to={`band/${band.slug}`}>{band.name}</Link>
          )
        })
      )
    }
    return null
  }

  render() {
    return (
      <section className="concert-card">
        <h2>{this.heading()}</h2>
        <span>{this.concert.date}</span> <span>{this.concert.city.lon}, {this.concert.city.lat}</span> <span>{this.concert.club}</span>
        <div className="bands">{this.bands()}</div>
      </section>
      
    )
  }
}

ConcertCard.propTypes = {
  concert: PropTypes.object,
}

export default ConcertCard
