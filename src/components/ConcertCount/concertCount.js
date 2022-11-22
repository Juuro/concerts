import PropTypes from "prop-types"
import React from "react"
import { Link } from "gatsby"

import "./concertCount.scss"

const ConcertCount = ({ concerts }) => {
  const now = new Date()

  const concertsInPast = () =>
    concerts.edges.filter(({ node }) => new Date(node.date) < now)

  const concertsInFuture = () =>
    concerts.edges.filter(({ node }) => new Date(node.date) > now)


  return (
    <span className="badge rounded-pill" title="Concerts planned">
      <span className="past badge bg-primary rounded-pill" title="Concerts visited">
        {concertsInPast().length}
      </span>
      {concertsInFuture().length}
    </span>
  )
}

ConcertCount.propTypes = {
  concert: PropTypes.object,
}

export default ConcertCount
