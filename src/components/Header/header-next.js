import Link from 'next/link'
import PropTypes from 'prop-types'
import React from 'react'

import ConcertCount from '../ConcertCount/concertCount'

import './header.scss'

const Header = ({ siteTitle = "", concerts }) => (
  <header className="bg-light shadow-sm">
    <div className="container">
      <h1>
        <Link href="/">{siteTitle}</Link>
      </h1>
      <wbr />
      {concerts && <ConcertCount concerts={{ edges: concerts.map(c => ({ node: c })), totalCount: concerts.length }} />}

      <nav>
        <a href="/">Home</a>
        <a href="/map">Map</a>
      </nav>
    </div>
  </header>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
  concerts: PropTypes.array,
}

export default Header
