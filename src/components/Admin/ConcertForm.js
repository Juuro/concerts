import React, { useState } from "react"
import PropTypes from "prop-types"

const ConcertForm = ({ environment, bands, onSuccess }) => {
  const [date, setDate] = useState("")
  const [club, setClub] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [selectedBands, setSelectedBands] = useState([])
  const [isFestival, setIsFestival] = useState(false)
  const [festivalName, setFestivalName] = useState("")
  const [festivalUrl, setFestivalUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const handleBandToggle = (bandId) => {
    setSelectedBands((prev) =>
      prev.includes(bandId)
        ? prev.filter((id) => id !== bandId)
        : [...prev, bandId]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage("")

    if (
      !date ||
      !club ||
      !latitude ||
      !longitude ||
      selectedBands.length === 0
    ) {
      setMessage(
        "Please fill in all required fields and select at least one band"
      )
      setSubmitting(false)
      return
    }

    if (isFestival && !festivalName) {
      setMessage("Festival name is required when creating a festival")
      setSubmitting(false)
      return
    }

    try {
      const fields = {
        date: {
          "en-US": date,
        },
        club: {
          "en-US": club,
        },
        city: {
          "en-US": {
            lat: parseFloat(latitude),
            lon: parseFloat(longitude),
          },
        },
        bands: {
          "en-US": selectedBands.map((bandId) => ({
            sys: {
              type: "Link",
              linkType: "Entry",
              id: bandId,
            },
          })),
        },
        isFestival: {
          "en-US": isFestival,
        },
      }

      if (isFestival) {
        fields.festival = {
          "en-US": {
            name: festivalName,
            ...(festivalUrl && { url: festivalUrl }),
          },
        }
      }

      const entry = await environment.createEntry("concert", { fields })
      await entry.publish()

      setMessage(`${isFestival ? "Festival" : "Concert"} created successfully!`)

      // Reset form
      setDate("")
      setClub("")
      setLatitude("")
      setLongitude("")
      setSelectedBands([])
      setIsFestival(false)
      setFestivalName("")
      setFestivalUrl("")

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error creating concert:", error)
      setMessage(`Error creating concert: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-form-container">
      <h3>Add New Concert/Festival</h3>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={isFestival}
              onChange={(e) => setIsFestival(e.target.checked)}
            />{" "}
            This is a festival
          </label>
        </div>

        {isFestival && (
          <>
            <div className="form-group">
              <label htmlFor="festivalName">
                Festival Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="festivalName"
                value={festivalName}
                onChange={(e) => setFestivalName(e.target.value)}
                placeholder="Enter festival name"
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="festivalUrl">Festival URL (optional)</label>
              <input
                type="url"
                id="festivalUrl"
                value={festivalUrl}
                onChange={(e) => setFestivalUrl(e.target.value)}
                placeholder="https://..."
                className="form-control"
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label htmlFor="concertDate">
            Date <span className="required">*</span>
          </label>
          <input
            type="date"
            id="concertDate"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="concertClub">
            Club/Venue <span className="required">*</span>
          </label>
          <input
            type="text"
            id="concertClub"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="Enter venue name"
            className="form-control"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="latitude">
              Latitude <span className="required">*</span>
            </label>
            <input
              type="number"
              id="latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g., 52.5200"
              step="any"
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="longitude">
              Longitude <span className="required">*</span>
            </label>
            <input
              type="number"
              id="longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g., 13.4050"
              step="any"
              className="form-control"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            Bands <span className="required">*</span>
          </label>
          <div className="bands-selection">
            {bands.length === 0 ? (
              <p>No bands available. Please create a band first.</p>
            ) : (
              bands
                .sort((a, b) =>
                  (a.fields.name?.["en-US"] || "").localeCompare(
                    b.fields.name?.["en-US"] || ""
                  )
                )
                .map((band) => (
                  <label key={band.sys.id} className="band-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedBands.includes(band.sys.id)}
                      onChange={() => handleBandToggle(band.sys.id)}
                    />{" "}
                    {band.fields.name?.["en-US"] || "Unnamed Band"}
                  </label>
                ))
            )}
          </div>
          <small className="form-text">
            Select one or more bands that performed at this{" "}
            {isFestival ? "festival" : "concert"}
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
          {submitting
            ? "Creating..."
            : `Create ${isFestival ? "Festival" : "Concert"}`}
        </button>
      </form>
    </div>
  )
}

ConcertForm.propTypes = {
  environment: PropTypes.object.isRequired,
  bands: PropTypes.array.isRequired,
  onSuccess: PropTypes.func,
}

export default ConcertForm
