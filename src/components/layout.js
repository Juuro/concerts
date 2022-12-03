/**
 * Layout component that queries for data
 * with Gatsby's StaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/static-query/
 */

import React from "react"
import PropTypes from "prop-types"
import { StaticQuery, graphql } from "gatsby"

import Header from "./Header/header"

import "../styles/layout.scss"

const Layout = ({ children }) => (
  <StaticQuery
    query={graphql`
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
    `}
    render={(data) => (
      <>
        <Header
          siteTitle={data.site.siteMetadata.title}
          concerts={data.allContentfulConcert}
        />

        {children}

        <footer>
          © {new Date().getFullYear()} · Built with ❤️ on 🌍! 🤟🏳️‍🌈
        </footer>
      </>
    )}
  />
)

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}

export default Layout
