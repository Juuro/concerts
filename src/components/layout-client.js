import React from 'react'
import PropTypes from 'prop-types'
import Header from './Header/header'
import '../styles/layout.scss'

const Layout = ({ children, concerts }) => {
  return (
    <>
      <Header
        siteTitle="Concerts"
        concerts={concerts}
      />

      {children}

      <footer>© {new Date().getFullYear()} · Built with ❤️ on 🌍! 🤟🏳️‍🌈</footer>
    </>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  concerts: PropTypes.array,
}

export default Layout
