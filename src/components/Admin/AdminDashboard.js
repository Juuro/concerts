import React, { useState, useEffect } from "react"
import PropTypes from "prop-types"
import ConcertForm from "./ConcertForm"
import BandForm from "./BandForm"
import "./admin.scss"

const AdminDashboard = ({ credentials, onLogout }) => {
  const [activeTab, setActiveTab] = useState("concerts")
  const [bands, setBands] = useState([])
  const [concerts, setConcerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState(null)
  const [environment, setEnvironment] = useState(null)

  useEffect(() => {
    const initializeContentful = async () => {
      try {
        const contentful = await import("contentful-management")
        const contentfulClient = contentful.createClient({
          accessToken: credentials.accessToken,
        })

        const space = await contentfulClient.getSpace(credentials.spaceId)
        const env = await space.getEnvironment("master")

        setClient(contentfulClient)
        setEnvironment(env)

        // Load existing bands and concerts
        const bandsResponse = await env.getEntries({
          content_type: "band",
          limit: 1000,
        })
        setBands(bandsResponse.items)

        const concertsResponse = await env.getEntries({
          content_type: "concert",
          limit: 1000,
        })
        setConcerts(concertsResponse.items)

        setLoading(false)
      } catch (error) {
        console.error("Error initializing Contentful:", error)
        alert("Failed to connect to Contentful. Please check your credentials.")
        onLogout()
      }
    }

    initializeContentful()
  }, [credentials, onLogout])

  const refreshData = async () => {
    if (!environment) return

    try {
      const bandsResponse = await environment.getEntries({
        content_type: "band",
        limit: 1000,
      })
      setBands(bandsResponse.items)

      const concertsResponse = await environment.getEntries({
        content_type: "concert",
        limit: 1000,
      })
      setConcerts(concertsResponse.items)
    } catch (error) {
      console.error("Error refreshing data:", error)
    }
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <h2>Loading...</h2>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h2>Admin Dashboard</h2>
        <button onClick={onLogout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === "concerts" ? "active" : ""}`}
          onClick={() => setActiveTab("concerts")}
        >
          Concerts ({concerts.length})
        </button>
        <button
          className={`tab ${activeTab === "bands" ? "active" : ""}`}
          onClick={() => setActiveTab("bands")}
        >
          Bands ({bands.length})
        </button>
      </div>

      <div className="admin-content">
        {activeTab === "concerts" && (
          <ConcertForm
            environment={environment}
            bands={bands}
            onSuccess={refreshData}
          />
        )}
        {activeTab === "bands" && (
          <BandForm environment={environment} onSuccess={refreshData} />
        )}
      </div>
    </div>
  )
}

AdminDashboard.propTypes = {
  credentials: PropTypes.shape({
    spaceId: PropTypes.string.isRequired,
    accessToken: PropTypes.string.isRequired,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
}

export default AdminDashboard
