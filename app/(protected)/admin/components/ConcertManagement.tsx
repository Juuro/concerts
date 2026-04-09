"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/Toast/Toast"
import { DATE_LOCALE } from "@/utils/dateLocale"

interface Concert {
  id: string
  venue: string | null
  latitude: number
  longitude: number
  date: string
  createdAt: string
  user: string
}

export default function ConcertManagement() {
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const { showToast } = useToast()

  const fetchConcerts = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())

    try {
      const response = await fetch("/api/admin/concerts/missing-city")
      if (!response.ok) throw new Error("Failed to fetch concerts")

      const data = await response.json()
      setConcerts(data.concerts)
      setTotal(data.total)
    } catch (error) {
      console.error("Error fetching concerts:", error)
      showToast({ message: "Failed to fetch concerts", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchConcerts()
  }, [fetchConcerts])

  const handleGeocode = async (concertId: string) => {
    setProcessingIds((prev) => new Set(prev).add(concertId))

    try {
      const response = await fetch(`/api/admin/concerts/${concertId}/geocode`, {
        method: "POST",
      })

      if (!response.ok) throw new Error("Failed to geocode concert")

      const data = await response.json()
      showToast({
        message: data.normalizedCity
          ? `City set to: ${data.normalizedCity}`
          : "Could not determine city",
        type: data.normalizedCity ? "success" : "info",
      })

      // Remove from list if city was determined
      if (data.normalizedCity) {
        setConcerts((prev) => prev.filter((c) => c.id !== concertId))
        setTotal((prev) => prev - 1)
      }
    } catch (error) {
      console.error("Error geocoding concert:", error)
      showToast({ message: "Failed to geocode concert", type: "error" })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(concertId)
        return next
      })
    }
  }

  const handleBulkGeocode = async () => {
    const concertIds = Array.from(selectedIds)
    if (concertIds.length === 0) return

    setProcessingIds((prev) => new Set([...prev, ...concertIds]))

    try {
      const response = await fetch("/api/admin/concerts/bulk-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concertIds }),
      })

      if (!response.ok) throw new Error("Failed to bulk geocode")

      const data = await response.json()
      showToast({
        message: `Geocoding queued for ${data.queued} concerts`,
        type: "success",
      })

      // Remove geocoded concerts from list after delay
      setTimeout(() => {
        setConcerts((prev) => prev.filter((c) => !selectedIds.has(c.id)))
        setTotal((prev) => prev - data.queued)
        setSelectedIds(new Set())
      }, 1000)
    } catch (error) {
      console.error("Error bulk geocoding:", error)
      showToast({ message: "Failed to bulk geocode concerts", type: "error" })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        concertIds.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  const toggleSelect = (concertId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(concertId)) {
        next.delete(concertId)
      } else {
        next.add(concertId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === concerts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(concerts.map((c) => c.id)))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(DATE_LOCALE)
  }

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  if (loading) {
    return (
      <div className="admin-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="admin-list__skeleton" />
        ))}
      </div>
    )
  }

  if (concerts.length === 0) {
    return (
      <div className="admin-list__empty">No concerts missing city data</div>
    )
  }

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="admin-bulk-actions">
          <span className="admin-bulk-actions__count">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleBulkGeocode}
            disabled={processingIds.size > 0}
          >
            Geocode Selected
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear Selection
          </button>
        </div>
      )}

      <div className="admin-filter">
        <label>
          <input
            type="checkbox"
            checked={
              selectedIds.size === concerts.length && concerts.length > 0
            }
            onChange={toggleSelectAll}
          />{" "}
          Select all ({total} total)
        </label>
      </div>

      <ul className="admin-list">
        {concerts.map((concert) => (
          <li key={concert.id} className="admin-list__item">
            <input
              type="checkbox"
              checked={selectedIds.has(concert.id)}
              onChange={() => toggleSelect(concert.id)}
              aria-label={`Select concert at ${concert.venue || "unknown venue"}`}
            />
            <div className="admin-list__info">
              <p className="admin-list__name">
                {concert.venue || "No venue specified"}
              </p>
              <p className="admin-list__meta">
                {formatDate(concert.date)} •{" "}
                {formatCoordinates(concert.latitude, concert.longitude)} •{" "}
                {concert.user}
              </p>
            </div>
            <div className="admin-list__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => handleGeocode(concert.id)}
                disabled={processingIds.has(concert.id)}
                aria-label={`Geocode concert at ${concert.venue || "unknown venue"}`}
              >
                {processingIds.has(concert.id) ? "..." : "Geocode"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
