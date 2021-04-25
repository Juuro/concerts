/**
 * Layout component that queries for data
 * with Gatsby's StaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/static-query/
 */

import React from "react"
import PropTypes from "prop-types"
import { StaticQuery, graphql } from "gatsby"
import { MapkitProvider } from 'react-mapkit'

import Header from "./header"

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
      }
    `}
    render={data => (
      <>
        <Header siteTitle={data.site.siteMetadata.title} />
        <div className="container">
          <MapkitProvider tokenOrCallback={'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjZKMzc1SlBIM0sifQ.eyJpYXQiOjE2MTkzNTU3MTUuMDQxLCJpc3MiOiJBOEw5VFJTWkNSIn0.Z9Fv2cs3vfHhGJOoVIj2e1vonKZBXh_GDfdLXCLJ3Wxbidj8F2W0c9JOCFoHRAEHV85fPtysX1DqvMPRD-_P9g'}>
            <main>{children}</main>
          </MapkitProvider>
          <footer>
            © {new Date().getFullYear()}, Built with
            {` `}
            <a href="https://www.gatsbyjs.org">Gatsby</a>
          </footer>
        </div>
      </>
    )}
  />
)

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}

export default Layout
