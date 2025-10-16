import React, { useState, useEffect } from "react"
import Layout from "../components/layout"
import Seo from "../components/seo"
import AdminLogin from "../components/Admin/AdminLogin"
import AdminDashboard from "../components/Admin/AdminDashboard"

const AdminPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState(null)

  useEffect(() => {
    // Check if user is already logged in
    const storedCredentials = sessionStorage.getItem("contentfulCredentials")
    if (storedCredentials) {
      try {
        const parsed = JSON.parse(storedCredentials)
        setCredentials(parsed)
        setIsAuthenticated(true)
      } catch (e) {
        sessionStorage.removeItem("contentfulCredentials")
      }
    }
  }, [])

  const handleLogin = (creds) => {
    setCredentials(creds)
    setIsAuthenticated(true)
    sessionStorage.setItem("contentfulCredentials", JSON.stringify(creds))
  }

  const handleLogout = () => {
    setCredentials(null)
    setIsAuthenticated(false)
    sessionStorage.removeItem("contentfulCredentials")
  }

  return (
    <Layout>
      <main>
        <div className="container">
          <Seo title="Admin" />
          {!isAuthenticated ? (
            <AdminLogin onLogin={handleLogin} />
          ) : (
            <AdminDashboard credentials={credentials} onLogout={handleLogout} />
          )}
        </div>
      </main>
    </Layout>
  )
}

export default AdminPage
