"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import VenueAutocomplete from "@/components/VenueAutocomplete/VenueAutocomplete"
import BandEditForm from "@/components/BandEditForm/BandEditForm"
import Dialog from "@/components/Dialog/Dialog"
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
    cost?: string | null
    isFestival: boolean
    festivalId?: string | null
    festivalName?: string | null
    bands: { bandId: string; name: string; slug?: string; isHeadliner?: boolean }[]
  }
  mode: "create" | "edit"
  currency?: string
  isAdmin?: boolean
}

interface ValidationResult {
  found: boolean
  name?: string
  correctedName?: string
  source?: string
}

type BandValidationState =
  | { type: "idle" }
  | { type: "validating" }
  | { type: "not-found"; name: string }
  | { type: "corrected"; original: string; correctedName: string }

type FestivalValidationState =
  | { type: "idle" }
  | { type: "validating" }
  | { type: "not-found"; name: string }
  | { type: "corrected"; original: string; correctedName: string }

export default function ConcertForm({ concert, mode, currency = "EUR", isAdmin = false }: ConcertFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [date, setDate] = useState(concert?.date?.split("T")[0] || "")
  const [cost, setCost] = useState(concert?.cost || "")
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
    { bandId: string; name: string; slug: string; isHeadliner: boolean }[]
  >(
    concert?.bands?.map((b) => ({
      bandId: b.bandId,
      name: b.name,
      slug: b.slug || "",
      isHeadliner: b.isHeadliner || false,
    })) || []
  )
  const [isSearching, setIsSearching] = useState(false)
  const [bandHighlightedIndex, setBandHighlightedIndex] = useState(-1)
  const [editingBandSlug, setEditingBandSlug] = useState<string | null>(null)

  // Festival search
  const [festivalSearch, setFestivalSearch] = useState(
    concert?.festivalName || ""
  )
  const [festivalResults, setFestivalResults] = useState<Festival[]>([])
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(
    concert?.festivalId && concert?.festivalName
      ? { id: concert.festivalId, name: concert.festivalName, slug: "" }
      : null
  )
  const [isFestivalSearching, setIsFestivalSearching] = useState(false)
  const [festivalHighlightedIndex, setFestivalHighlightedIndex] = useState(-1)

  // Band validation state
  const [bandValidation, setBandValidation] = useState<BandValidationState>({ type: "idle" })
  const [pendingBandName, setPendingBandName] = useState("")

  // Festival validation state
  const [festivalValidation, setFestivalValidation] = useState<FestivalValidationState>({ type: "idle" })
  const [pendingFestivalName, setPendingFestivalName] = useState("")

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

  useEffect(() => {
    setBandHighlightedIndex(-1)
  }, [bandResults])

  // Debounced festival search
  useEffect(() => {
    if (selectedFestival || festivalSearch.length < 2) {
      setFestivalResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsFestivalSearching(true)
      try {
        const res = await fetch(
          `/api/festivals/search?q=${encodeURIComponent(festivalSearch)}`
        )
        if (res.ok) {
          const data = await res.json()
          setFestivalResults(data)
        }
      } catch (err) {
        console.error("Festival search error:", err)
      } finally {
        setIsFestivalSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [festivalSearch, selectedFestival])

  useEffect(() => {
    setFestivalHighlightedIndex(-1)
  }, [festivalResults])

  const handleAddBand = useCallback((band: Band) => {
    setSelectedBands((prev) => {
      if (prev.some((b) => b.bandId === band.id)) return prev
      return [
        ...prev,
        { bandId: band.id, name: band.name, slug: band.slug, isHeadliner: prev.length === 0 },
      ]
    })
    setBandSearch("")
    setBandResults([])
    setBandHighlightedIndex(-1)
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

  const handleSelectFestival = useCallback((festival: Festival) => {
    setSelectedFestival(festival)
    setFestivalId(festival.id)
    setFestivalSearch(festival.name)
    setFestivalResults([])
    setFestivalHighlightedIndex(-1)
  }, [])

  const handleClearFestival = useCallback(() => {
    setSelectedFestival(null)
    setFestivalId("")
    setFestivalSearch("")
    setFestivalResults([])
    setFestivalHighlightedIndex(-1)
  }, [])

  const doCreateBand = async (name: string) => {
    try {
      const res = await fetch("/api/bands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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

  const handleCreateBand = async () => {
    const name = bandSearch.trim()
    if (!name) return

    setPendingBandName(name)
    setBandValidation({ type: "validating" })

    try {
      const res = await fetch(`/api/bands/validate?name=${encodeURIComponent(name)}`)
      if (!res.ok) {
        // Validation endpoint failed -- proceed without blocking
        await doCreateBand(name)
        setBandValidation({ type: "idle" })
        return
      }

      const data: ValidationResult = await res.json()

      if (data.found && data.correctedName && data.correctedName.toLowerCase() !== name.toLowerCase()) {
        // Found with a different name -- suggest correction
        setBandValidation({ type: "corrected", original: name, correctedName: data.correctedName })
      } else if (data.found) {
        // Exact match found -- proceed directly
        await doCreateBand(data.name || name)
        setBandValidation({ type: "idle" })
      } else {
        // Not found -- warn the user
        setBandValidation({ type: "not-found", name })
      }
    } catch (err) {
      console.error("Band validation error:", err)
      // On error, proceed without blocking
      await doCreateBand(name)
      setBandValidation({ type: "idle" })
    }
  }

  const handleBandValidationConfirm = async (useCorrectedName?: boolean) => {
    const name = useCorrectedName && bandValidation.type === "corrected"
      ? bandValidation.correctedName
      : pendingBandName
    setBandValidation({ type: "idle" })
    setPendingBandName("")
    await doCreateBand(name)
  }

  const handleBandValidationCancel = () => {
    setBandValidation({ type: "idle" })
    setPendingBandName("")
  }

  const handleBandKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = bandResults.length

    if (totalItems === 0) {
      if (e.key === "Escape") {
        setBandSearch("")
        setBandResults([])
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setBandHighlightedIndex((prev) =>
          prev < totalItems - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setBandHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (
          bandHighlightedIndex >= 0 &&
          bandHighlightedIndex < bandResults.length
        ) {
          handleAddBand(bandResults[bandHighlightedIndex])
        }
        break
      case " ":
        if (
          bandHighlightedIndex >= 0 &&
          bandHighlightedIndex < bandResults.length
        ) {
          e.preventDefault()
          handleAddBand(bandResults[bandHighlightedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setBandSearch("")
        setBandResults([])
        setBandHighlightedIndex(-1)
        break
      case "Tab":
        setBandResults([])
        setBandHighlightedIndex(-1)
        break
    }
  }

  const handleFestivalKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = festivalResults.length

    if (totalItems === 0) {
      if (e.key === "Escape") {
        setFestivalSearch("")
        setFestivalResults([])
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setFestivalHighlightedIndex((prev) =>
          prev < totalItems - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setFestivalHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (
          festivalHighlightedIndex >= 0 &&
          festivalHighlightedIndex < festivalResults.length
        ) {
          handleSelectFestival(festivalResults[festivalHighlightedIndex])
        }
        break
      case " ":
        if (
          festivalHighlightedIndex >= 0 &&
          festivalHighlightedIndex < festivalResults.length
        ) {
          e.preventDefault()
          handleSelectFestival(festivalResults[festivalHighlightedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setFestivalSearch("")
        setFestivalResults([])
        setFestivalHighlightedIndex(-1)
        break
      case "Tab":
        setFestivalResults([])
        setFestivalHighlightedIndex(-1)
        break
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

  const doSubmit = async (festivalNameOverride?: string) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const newFestivalName = festivalNameOverride ??
        (isFestival && !selectedFestival && festivalSearch.trim()
          ? festivalSearch.trim()
          : undefined)

      const payload = {
        date,
        latitude,
        longitude,
        venue,
        isFestival,
        festivalId: isFestival && selectedFestival ? selectedFestival.id : undefined,
        festivalName: newFestivalName,
        cost: cost ? parseFloat(cost) : null,
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
        router.push("/")
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!venueSelected || !latitude || !longitude) {
      setError("Please select a venue from the search results")
      return
    }

    // If a new festival name is being created, validate first
    const newFestivalName = isFestival && !selectedFestival && festivalSearch.trim()
      ? festivalSearch.trim()
      : null

    if (newFestivalName) {
      setPendingFestivalName(newFestivalName)
      setFestivalValidation({ type: "validating" })

      try {
        const res = await fetch(`/api/festivals/validate?name=${encodeURIComponent(newFestivalName)}`)
        if (!res.ok) {
          await doSubmit()
          setFestivalValidation({ type: "idle" })
          return
        }

        const data: ValidationResult = await res.json()

        if (data.found && data.correctedName && data.correctedName.toLowerCase() !== newFestivalName.toLowerCase()) {
          setFestivalValidation({ type: "corrected", original: newFestivalName, correctedName: data.correctedName })
          return
        } else if (data.found) {
          await doSubmit(data.name || newFestivalName)
          setFestivalValidation({ type: "idle" })
          return
        } else {
          setFestivalValidation({ type: "not-found", name: newFestivalName })
          return
        }
      } catch (err) {
        console.error("Festival validation error:", err)
        await doSubmit()
        setFestivalValidation({ type: "idle" })
        return
      }
    }

    await doSubmit()
  }

  const handleFestivalValidationConfirm = async (useCorrectedName?: boolean) => {
    const name = useCorrectedName && festivalValidation.type === "corrected"
      ? festivalValidation.correctedName
      : pendingFestivalName
    setFestivalValidation({ type: "idle" })
    setPendingFestivalName("")
    await doSubmit(name)
  }

  const handleFestivalValidationCancel = () => {
    setFestivalValidation({ type: "idle" })
    setPendingFestivalName("")
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
        router.push("/")
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
    <>
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

        <div className="concert-form__field">
          <label htmlFor="cost">Ticket Cost ({currency})</label>
          <input
            type="number"
            id="cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
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
              role="combobox"
              aria-expanded={bandResults.length > 0}
              aria-controls="band-listbox"
              aria-activedescendant={
                bandHighlightedIndex >= 0
                  ? `band-option-${bandHighlightedIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-haspopup="listbox"
              value={bandSearch}
              onChange={(e) => setBandSearch(e.target.value)}
              onKeyDown={handleBandKeyDown}
              placeholder="Type to search bands..."
            />
            {isSearching && (
              <span className="concert-form__searching">Searching...</span>
            )}
          </div>

          {bandResults.length > 0 && (
            <ul
              className="concert-form__results"
              role="listbox"
              id="band-listbox"
              aria-label="Band search results"
            >
              {bandResults.map((band, index) => (
                <li
                  key={band.id}
                  role="option"
                  id={`band-option-${index}`}
                  aria-selected={index === bandHighlightedIndex}
                  className={
                    index === bandHighlightedIndex ? "highlighted" : ""
                  }
                  onMouseEnter={() => setBandHighlightedIndex(index)}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleAddBand(band)}
                  >
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
                {isAdmin && band.slug && (
                  <button
                    type="button"
                    className="concert-form__band-edit"
                    onClick={() => setEditingBandSlug(band.slug)}
                    aria-label={`Edit ${band.name}`}
                    title={`Edit ${band.name}`}
                  >
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                      <path
                        d="M16.474 5.408l2.118 2.118m-.756-3.982L12.109 9.27a2.118 2.118 0 00-.58 1.082L11 13l2.648-.53a2.118 2.118 0 001.082-.58l5.727-5.727a1.853 1.853 0 10-2.621-2.621z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M19 15v3a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  className="concert-form__band-remove"
                  onClick={() => handleRemoveBand(band.bandId)}
                  aria-label={`Remove ${band.name}`}
                  title={`Remove ${band.name}`}
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                  >
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
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
              onChange={(e) => {
                setIsFestival(e.target.checked)
                if (!e.target.checked) {
                  handleClearFestival()
                }
              }}
            />
            This was a festival
          </label>
        </div>

        {isFestival && (
          <div className="concert-form__field">
            <label htmlFor="festivalSearch">Festival name</label>

            {selectedFestival ? (
              <div className="concert-form__selected-festival">
                <span className="concert-form__selected-festival-name">
                  {selectedFestival.name}
                </span>
                <button
                  type="button"
                  className="concert-form__selected-festival-clear"
                  onClick={handleClearFestival}
                  aria-label={`Clear festival ${selectedFestival.name}`}
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                  >
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <div className="concert-form__search">
                  <input
                    type="text"
                    id="festivalSearch"
                    role="combobox"
                    aria-expanded={festivalResults.length > 0}
                    aria-controls="festival-listbox"
                    aria-activedescendant={
                      festivalHighlightedIndex >= 0
                        ? `festival-option-${festivalHighlightedIndex}`
                        : undefined
                    }
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    value={festivalSearch}
                    onChange={(e) => setFestivalSearch(e.target.value)}
                    onKeyDown={handleFestivalKeyDown}
                    placeholder="Type to search festivals..."
                  />
                  {isFestivalSearching && (
                    <span className="concert-form__searching">
                      Searching...
                    </span>
                  )}
                </div>

                {festivalResults.length > 0 && (
                  <ul
                    className="concert-form__results"
                    role="listbox"
                    id="festival-listbox"
                    aria-label="Festival search results"
                  >
                    {festivalResults.map((festival, index) => (
                      <li
                        key={festival.id}
                        role="option"
                        id={`festival-option-${index}`}
                        aria-selected={index === festivalHighlightedIndex}
                        className={
                          index === festivalHighlightedIndex
                            ? "highlighted"
                            : ""
                        }
                        onMouseEnter={() =>
                          setFestivalHighlightedIndex(index)
                        }
                      >
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => handleSelectFestival(festival)}
                        >
                          {festival.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {festivalSearch.length >= 2 &&
                  festivalResults.length === 0 &&
                  !isFestivalSearching && (
                    <div className="concert-form__no-results">
                      <span>
                        No festivals found. &quot;{festivalSearch}&quot; will be
                        created on save.
                      </span>
                    </div>
                  )}
              </>
            )}
          </div>
        )}
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

    {isAdmin &&
      selectedBands
        .filter((band) => band.slug)
        .map((band) => (
          <Dialog
            key={band.bandId}
            open={editingBandSlug === band.slug}
            onClose={() => setEditingBandSlug(null)}
            title={`Edit ${band.name}`}
          >
            <BandEditForm
              band={{ slug: band.slug, name: band.name }}
              onSave={(updated) => {
                setSelectedBands((prev) =>
                  prev.map((b) =>
                    b.slug === band.slug ? { ...b, name: updated.name } : b
                  )
                )
                setEditingBandSlug(null)
              }}
              onCancel={() => setEditingBandSlug(null)}
            />
          </Dialog>
        ))}

    {/* Band validation dialog */}
    <Dialog
      open={bandValidation.type === "not-found" || bandValidation.type === "corrected"}
      onClose={handleBandValidationCancel}
      title="Verify band name"
    >
      {bandValidation.type === "not-found" && (
        <div className="concert-form__validation-dialog">
          <p>
            &quot;{bandValidation.name}&quot; was not found on MusicBrainz or Last.fm. Are you sure the name is correct?
          </p>
          <div className="concert-form__validation-actions">
            <button type="button" onClick={handleBandValidationCancel}>
              Cancel
            </button>
            <button type="button" onClick={() => handleBandValidationConfirm()}>
              Create anyway
            </button>
          </div>
        </div>
      )}
      {bandValidation.type === "corrected" && (
        <div className="concert-form__validation-dialog">
          <p>
            Did you mean &quot;{bandValidation.correctedName}&quot;?
          </p>
          <div className="concert-form__validation-actions">
            <button type="button" onClick={handleBandValidationCancel}>
              Cancel
            </button>
            <button type="button" onClick={() => handleBandValidationConfirm(false)}>
              Create as &quot;{bandValidation.original}&quot;
            </button>
            <button type="button" onClick={() => handleBandValidationConfirm(true)}>
              Use &quot;{bandValidation.correctedName}&quot;
            </button>
          </div>
        </div>
      )}
    </Dialog>

    {/* Festival validation dialog */}
    <Dialog
      open={festivalValidation.type === "not-found" || festivalValidation.type === "corrected"}
      onClose={handleFestivalValidationCancel}
      title="Verify festival name"
    >
      {festivalValidation.type === "not-found" && (
        <div className="concert-form__validation-dialog">
          <p>
            &quot;{festivalValidation.name}&quot; was not found on MusicBrainz. Are you sure the name is correct?
          </p>
          <div className="concert-form__validation-actions">
            <button type="button" onClick={handleFestivalValidationCancel}>
              Cancel
            </button>
            <button type="button" onClick={() => handleFestivalValidationConfirm()}>
              Create anyway
            </button>
          </div>
        </div>
      )}
      {festivalValidation.type === "corrected" && (
        <div className="concert-form__validation-dialog">
          <p>
            Did you mean &quot;{festivalValidation.correctedName}&quot;?
          </p>
          <div className="concert-form__validation-actions">
            <button type="button" onClick={handleFestivalValidationCancel}>
              Cancel
            </button>
            <button type="button" onClick={() => handleFestivalValidationConfirm(false)}>
              Create as &quot;{festivalValidation.original}&quot;
            </button>
            <button type="button" onClick={() => handleFestivalValidationConfirm(true)}>
              Use &quot;{festivalValidation.correctedName}&quot;
            </button>
          </div>
        </div>
      )}
    </Dialog>

    {/* Band validating loading indicator */}
    {bandValidation.type === "validating" && (
      <div className="concert-form__validating" aria-live="polite">
        Checking band name...
      </div>
    )}
    {festivalValidation.type === "validating" && (
      <div className="concert-form__validating" aria-live="polite">
        Checking festival name...
      </div>
    )}
    </>
  )
}
