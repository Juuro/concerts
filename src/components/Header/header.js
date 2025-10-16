import { Link } from "gatsby"
import PropTypes from "prop-types"
import React from "react"

import ConcertCount from "../ConcertCount/concertCount"

import "./header.scss"

const Header = ({ siteTitle = "", concerts }) => (
  <header className="bg-light shadow-sm">
    <div className="container">
      <h1>
        <Link to="/">{siteTitle}</Link>
      </h1>
      <wbr />
      <ConcertCount concerts={concerts} />

      <nav>
        <a href="/">Home</a>
        <a href="/map">Map</a>
        <a href="/statistics">Statistics</a>
      </nav>
    </div>
  </header>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
}

export default Header
