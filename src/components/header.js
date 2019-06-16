import { Link } from 'gatsby'
import PropTypes from 'prop-types'
import React from 'react'

const Header = ({ siteTitle, totalConcerts }) => (
  <header className="bg-light shadow-sm">
    <div className="container">
      <h1>
        <Link to="/">{siteTitle}</Link>{' '}
        <span className="badge">{totalConcerts}</span>
      </h1>
    </div>
  </header>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
  totalConcerts: PropTypes.number.isRequired,
}

Header.defaultProps = {
  siteTitle: ``,
}

export default Header
