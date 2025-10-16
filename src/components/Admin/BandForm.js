import React, { useState } from "react"
import PropTypes from "prop-types"

const BandForm = ({ environment, onSuccess }) => {
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [image, setImage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const generateSlug = (text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage("")

    if (!name) {
      setMessage("Band name is required")
      setSubmitting(false)
      return
    }

    try {
      const slug = generateSlug(name)

      const entry = await environment.createEntry("band", {
        fields: {
          name: {
            "en-US": name,
          },
          slug: {
            "en-US": slug,
          },
          ...(url && {
            url: {
              "en-US": url,
            },
          }),
          ...(image && {
            image: {
              "en-US": {
                sys: {
                  type: "Link",
                  linkType: "Asset",
                  id: image,
                },
              },
            },
          }),
        },
      })

      await entry.publish()

      setMessage(`Band "${name}" created successfully!`)
      setName("")
      setUrl("")
      setImage("")

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error creating band:", error)
      setMessage(`Error creating band: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-form-container">
      <h3>Add New Band</h3>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="bandName">
            Band Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="bandName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter band name"
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="bandUrl">Band URL (optional)</label>
          <input
            type="url"
            id="bandUrl"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bandImage">Image Asset ID (optional)</label>
          <input
            type="text"
            id="bandImage"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Asset ID from Contentful"
            className="form-control"
          />
          <small className="form-text">
            Upload image to Contentful Media first, then paste the Asset ID here
          </small>
        </div>

        {message && (
          <div
            className={`alert ${
              message.includes("Error") ? "alert-danger" : "alert-success"
            }`}
          >
            {message}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creating..." : "Create Band"}
        </button>
      </form>
    </div>
  )
}

BandForm.propTypes = {
  environment: PropTypes.object.isRequired,
  onSuccess: PropTypes.func,
}

export default BandForm
