import React from "react"
import Header from "./Header/header"
import Footer from "./Footer/Footer"
import "../styles/layout.scss"

interface LayoutProps {
  children: React.ReactNode
  concertCounts?: {
    past: number
    future: number
  }
}

const Layout: React.FC<LayoutProps> = ({ children, concertCounts }) => {
  return (
    <>
      <Header siteTitle="Concerts" concertCounts={concertCounts} />

      {children}

      <Footer />
    </>
  )
}

export default Layout
