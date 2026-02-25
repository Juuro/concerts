"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/Toast/Toast"

interface Festival {
  id: string
  name: string
  slug: string
  url: string | null
  createdAt: string
  createdBy: string | null
}

export default function FestivalManagement() {
  const [festivals, setFestivals] = useState<Festival[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const { showToast } = useToast()

  const fetchFestivals = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())

    try {
      const response = await fetch("/api/admin/festivals/orphans")
      if (!response.ok) throw new Error("Failed to fetch festivals")

      const data = await response.json()
      setFestivals(data.festivals)
      setTotal(data.total)
    } catch (error) {
      console.error("Error fetching festivals:", error)
      showToast({ message: "Failed to fetch orphaned festivals", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchFestivals()
  }, [fetchFestivals])

  const handleDelete = async (festivalIds: string[]) => {
    if (!confirm(`Delete ${festivalIds.length} festival(s)? This cannot be undone.`)) {
      return
    }

    setProcessingIds((prev) => new Set([...prev, ...festivalIds]))

    try {
      const response = await fetch("/api/admin/festivals/orphans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ festivalIds }),
      })

      if (!response.ok) throw new Error("Failed to delete festivals")

      const data = await response.json()
      showToast({
        message: `Deleted ${data.deleted} festival(s)`,
        type: "success",
      })

      setFestivals((prev) => prev.filter((f) => !festivalIds.includes(f.id)))
      setTotal((prev) => prev - data.deleted)
      setSelectedIds(new Set())
    } catch (error) {
      console.error("Error deleting festivals:", error)
      showToast({ message: "Failed to delete festivals", type: "error" })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        festivalIds.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  const toggleSelect = (festivalId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(festivalId)) {
        next.delete(festivalId)
      } else {
        next.add(festivalId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === festivals.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(festivals.map((f) => f.id)))
    }
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

  if (festivals.length === 0) {
    return (
      <div className="admin-list__empty">
        No orphaned festivals found
      </div>
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
            className="admin-btn admin-btn--danger"
            onClick={() => handleDelete(Array.from(selectedIds))}
            disabled={processingIds.size > 0}
          >
            Delete Selected
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
            checked={selectedIds.size === festivals.length && festivals.length > 0}
            onChange={toggleSelectAll}
          />
          {" "}Select all ({total} total)
        </label>
      </div>

      <ul className="admin-list">
        {festivals.map((festival) => (
          <li key={festival.id} className="admin-list__item">
            <input
              type="checkbox"
              checked={selectedIds.has(festival.id)}
              onChange={() => toggleSelect(festival.id)}
              aria-label={`Select ${festival.name}`}
            />
            <div className="admin-list__info">
              <p className="admin-list__name">
                {festival.url ? (
                  <a href={festival.url} target="_blank" rel="noopener noreferrer">
                    {festival.name}
                  </a>
                ) : (
                  festival.name
                )}
              </p>
              <p className="admin-list__meta">
                {festival.createdBy && `Created by ${festival.createdBy}`}
              </p>
            </div>
            <div className="admin-list__actions">
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={() => handleDelete([festival.id])}
                disabled={processingIds.has(festival.id)}
                aria-label={`Delete ${festival.name}`}
              >
                {processingIds.has(festival.id) ? "..." : "Delete"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
