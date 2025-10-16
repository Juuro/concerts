import React, { useState } from "react"
import PropTypes from "prop-types"
import "./admin.scss"

const AdminLogin = ({ onLogin }) => {
  const [spaceId, setSpaceId] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (!spaceId || !accessToken) {
      setError("Please enter both Space ID and Management Token")
      return
    }

    try {
      // Test the credentials by attempting to create a client
      const contentful = await import("contentful-management")
      const client = contentful.createClient({
        accessToken: accessToken,
      })

      // Try to get the space to validate credentials
      await client.getSpace(spaceId)

      // If successful, call onLogin
      onLogin({ spaceId, accessToken })
    } catch (err) {
      setError(
        "Invalid credentials. Please check your Space ID and Management Token."
      )
      console.error("Login error:", err)
    }
  }

  return (
    <div className="admin-login">
      <h2>Admin Login</h2>
      <p>Enter your Contentful credentials to manage concerts and bands.</p>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="spaceId">Space ID</label>
          <input
            type="text"
            id="spaceId"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            placeholder="Enter your Contentful Space ID"
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label htmlFor="accessToken">Management API Token</label>
          <input
            type="password"
            id="accessToken"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Enter your Management API Token"
            className="form-control"
          />
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <button type="submit" className="btn btn-primary">
          Login
        </button>
      </form>

      <div className="admin-help">
        <h3>How to get your credentials:</h3>
        <ol>
          <li>
            Go to{" "}
            <a
              href="https://app.contentful.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contentful Dashboard
            </a>
          </li>
          <li>Select your space</li>
          <li>Space ID: Found in Settings → General settings</li>
          <li>
            Management Token: Found in Settings → API keys → Content management
            tokens
          </li>
        </ol>
      </div>
    </div>
  )
}

AdminLogin.propTypes = {
  onLogin: PropTypes.func.isRequired,
}

export default AdminLogin
