import React from "react"
import PropTypes from "prop-types"
import { useStaticQuery, graphql } from "gatsby"

import Header from "./Header/header"

import "../styles/layout.scss"

const Layout = ({ children }) => {
  const data = useStaticQuery(graphql`
    query SiteTitleQuery {
      site {
        siteMetadata {
          title
        }
      }
      allContentfulConcert(sort: { date: DESC }) {
        edges {
          node {
            ...ContentfulConcertFields
          }
        }
        totalCount
      }
    }
  `)
  return <>
    <Header
      siteTitle={data.site.siteMetadata.title}
      concerts={data.allContentfulConcert}
    />

    {children}

    <footer>© {new Date().getFullYear()} · Built with ❤️ on 🌍! 🤟🏳️‍🌈</footer>
  </>
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}

export default Layout
