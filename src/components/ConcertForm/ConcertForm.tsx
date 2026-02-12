"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import VenueAutocomplete from "@/components/VenueAutocomplete/VenueAutocomplete"
import type { PhotonSearchResult } from "@/types/photon"
import "./concertForm.scss"

interface Band {
  id: string
  name: string
  slug: string
}

interface Festival {
  id: string
  name: string
  slug: string
}

interface ConcertFormProps {
  concert?: {
    id: string
    date: string
    latitude: number
    longitude: number
    venue?: string | null
    isFestival: boolean
    festivalId?: string | null
    bands: { bandId: string; name: string; isHeadliner?: boolean }[]
  }
  mode: "create" | "edit"
}

export default function ConcertForm({ concert, mode }: ConcertFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [date, setDate] = useState(concert?.date?.split("T")[0] || "")
  const [venue, setVenue] = useState(concert?.venue || "")
  const [latitude, setLatitude] = useState<number | undefined>(
    concert?.latitude
  )
  const [longitude, setLongitude] = useState<number | undefined>(
    concert?.longitude
  )
  const [venueSelected, setVenueSelected] = useState(!!concert?.venue)
  const [isFestival, setIsFestival] = useState(concert?.isFestival || false)
  const [festivalId, setFestivalId] = useState(concert?.festivalId || "")

  // Band search
  const [bandSearch, setBandSearch] = useState("")
  const [bandResults, setBandResults] = useState<Band[]>([])
  const [selectedBands, setSelectedBands] = useState<
    { bandId: string; name: string; isHeadliner: boolean }[]
  >(
    concert?.bands?.map((b) => ({
      bandId: b.bandId,
      name: b.name,
      isHeadliner: b.isHeadliner || false,
    })) || []
  )
  const [isSearching, setIsSearching] = useState(false)

  // Festival search
  const [festivalSearch, setFestivalSearch] = useState("")
  const [festivalResults, setFestivalResults] = useState<Festival[]>([])
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(
    null
  )

  // Debounced band search
  useEffect(() => {
    if (bandSearch.length < 2) {
      setBandResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(
          `/api/bands/search?q=${encodeURIComponent(bandSearch)}`
        )
        if (res.ok) {
          const data = await res.json()
          setBandResults(data)
        }
      } catch (err) {
        console.error("Band search error:", err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [bandSearch])

  const handleAddBand = useCallback((band: Band) => {
    setSelectedBands((prev) => {
      if (prev.some((b) => b.bandId === band.id)) return prev
      return [
        ...prev,
        { bandId: band.id, name: band.name, isHeadliner: prev.length === 0 },
      ]
    })
    setBandSearch("")
    setBandResults([])
  }, [])

  const handleRemoveBand = useCallback((bandId: string) => {
    setSelectedBands((prev) => prev.filter((b) => b.bandId !== bandId))
  }, [])

  const handleToggleHeadliner = useCallback((bandId: string) => {
    setSelectedBands((prev) =>
      prev.map((b) =>
        b.bandId === bandId ? { ...b, isHeadliner: !b.isHeadliner } : b
      )
    )
  }, [])

  const handleCreateBand = async () => {
    if (!bandSearch.trim()) return

    try {
      const res = await fetch("/api/bands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: bandSearch.trim() }),
      })

      if (res.ok) {
        const newBand = await res.json()
        handleAddBand({
          id: newBand.id,
          name: newBand.name,
          slug: newBand.slug,
        })
      } else if (res.status === 409) {
        setError("A band with this name already exists")
      }
    } catch (err) {
      console.error("Create band error:", err)
    }
  }

  const handleVenueSelect = (result: PhotonSearchResult) => {
    setVenue(result.name)
    setLatitude(result.lat)
    setLongitude(result.lon)
    setVenueSelected(true)
  }

  const handleVenueClear = () => {
    setVenue("")
    setLatitude(undefined)
    setLongitude(undefined)
    setVenueSelected(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!venueSelected || !latitude || !longitude) {
      setError("Please select a venue from the search results")
      setIsSubmitting(false)
      return
    }

    try {
      const payload = {
        date,
        latitude,
        longitude,
        venue,
        isFestival,
        festivalId: isFestival ? festivalId || undefined : undefined,
        bandIds: selectedBands.map((b) => ({
          bandId: b.bandId,
          isHeadliner: b.isHeadliner,
        })),
      }

      const url =
        mode === "create" ? "/api/concerts" : `/api/concerts/${concert?.id}`
      const method = mode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        router.push("/dashboard")
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || "Failed to save concert")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (
      !concert?.id ||
      !confirm("Are you sure you want to delete this concert?")
    )
      return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/concerts/${concert.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setError("Failed to delete concert")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="concert-form" onSubmit={handleSubmit}>
      {error && <div className="concert-form__error">{error}</div>}

      <div className="concert-form__section">
        <h3>When & Where</h3>

        <div className="concert-form__field">
          <label htmlFor="date">Date *</label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="concert-form__field">
          <label htmlFor="venue">Venue *</label>
          <VenueAutocomplete
            value={venue}
            latitude={latitude}
            longitude={longitude}
            onSelect={handleVenueSelect}
            onClear={handleVenueClear}
            disabled={isSubmitting}
            error={
              !venueSelected && venue
                ? "Please select a venue from the dropdown"
                : undefined
            }
          />
          {venueSelected && latitude && longitude && (
            <div className="concert-form__venue-coords">
              ✓ Selected: {venue} ({latitude.toFixed(4)}, {longitude.toFixed(4)})
            </div>
          )}
        </div>
      </div>

      <div className="concert-form__section">
        <h3>Bands *</h3>

        <div className="concert-form__field">
          <label htmlFor="bandSearch">Search or add bands</label>
          <div className="concert-form__search">
            <input
              type="text"
              id="bandSearch"
              value={bandSearch}
              onChange={(e) => setBandSearch(e.target.value)}
              placeholder="Type to search bands..."
            />
            {isSearching && (
              <span className="concert-form__searching">Searching...</span>
            )}
          </div>

          {bandResults.length > 0 && (
            <ul className="concert-form__results">
              {bandResults.map((band) => (
                <li key={band.id}>
                  <button type="button" onClick={() => handleAddBand(band)}>
                    {band.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {bandSearch.length >= 2 &&
            bandResults.length === 0 &&
            !isSearching && (
              <div className="concert-form__no-results">
                <span>No bands found.</span>
                <button type="button" onClick={handleCreateBand}>
                  Create &quot;{bandSearch}&quot;
                </button>
              </div>
            )}
        </div>

        {selectedBands.length > 0 && (
          <div className="concert-form__selected-bands">
            {selectedBands.map((band) => (
              <div key={band.bandId} className="concert-form__band-tag">
                <span>{band.name}</span>
                <label className="concert-form__headliner">
                  <input
                    type="checkbox"
                    checked={band.isHeadliner}
                    onChange={() => handleToggleHeadliner(band.bandId)}
                  />
                  Headliner
                </label>
                <button
                  type="button"
                  onClick={() => handleRemoveBand(band.bandId)}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="concert-form__section">
        <h3>Festival</h3>

        <div className="concert-form__field concert-form__checkbox">
          <label>
            <input
              type="checkbox"
              checked={isFestival}
              onChange={(e) => setIsFestival(e.target.checked)}
            />
            This was a festival
          </label>
        </div>
      </div>

      <div className="concert-form__actions">
        <button
          type="button"
          className="concert-form__cancel"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </button>

        {mode === "edit" && (
          <button
            type="button"
            className="concert-form__delete"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            Delete
          </button>
        )}

        <button
          type="submit"
          className="concert-form__submit"
          disabled={isSubmitting || selectedBands.length === 0 || !venueSelected}
        >
          {isSubmitting
            ? "Saving..."
            : mode === "create"
              ? "Add Concert"
              : "Save Changes"}
        </button>
      </div>
    </form>
  )
}
