"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { KeyboardEvent } from "react"
import Link from "next/link"
import { useToast } from "@/components/Toast/Toast"

interface Band {
  id: string
  name: string
  slug: string
  imageUrl?: string | null
  createdAt: string
  concertCount?: number
  createdBy?: string | null
}

type TabType =
  | "missing-images"
  | "enrichment-failed"
  | "missing-lastfm"
  | "orphaned"

const TABS: { id: TabType; label: string }[] = [
  { id: "missing-images", label: "Missing Images" },
  { id: "enrichment-failed", label: "Enrichment Failed" },
  { id: "missing-lastfm", label: "Missing Last.fm" },
  { id: "orphaned", label: "Orphaned Bands" },
]

export default function BandManagement() {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [activeTab, setActiveTab] = useState<TabType>("missing-images")
  const [bands, setBands] = useState<Band[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const { showToast } = useToast()

  const fetchBands = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())

    try {
      let url: string
      switch (activeTab) {
        case "missing-images":
          url = "/api/admin/bands/missing-images"
          break
        case "enrichment-failed":
          url = "/api/admin/bands/enrichment-failed"
          break
        case "missing-lastfm":
          url = "/api/admin/bands/missing-lastfm"
          break
        case "orphaned":
          url = "/api/bands/orphans"
          break
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch bands")

      const data = await response.json()
      setBands(data.bands)
      setTotal(data.total)
    } catch (error) {
      console.error("Error fetching bands:", error)
      showToast({ message: "Failed to fetch bands", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [activeTab, showToast])

  useEffect(() => {
    fetchBands()
  }, [fetchBands])

  const handleEnrich = async (bandId: string, imageOnly: boolean = false) => {
    setProcessingIds((prev) => new Set(prev).add(bandId))

    try {
      const response = await fetch(`/api/admin/bands/${bandId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageOnly }),
      })

      if (!response.ok) throw new Error("Failed to enrich band")

      const data = await response.json()
      showToast({
        message: `Enrichment queued for ${data.bandName}`,
        type: "success",
      })

      // Remove from list after a short delay
      setTimeout(() => {
        setBands((prev) => prev.filter((b) => b.id !== bandId))
        setTotal((prev) => prev - 1)
      }, 1000)
    } catch (error) {
      console.error("Error enriching band:", error)
      showToast({ message: "Failed to enrich band", type: "error" })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(bandId)
        return next
      })
    }
  }

  const handleBulkEnrich = async () => {
    const bandIds = Array.from(selectedIds)
    if (bandIds.length === 0) return

    setProcessingIds((prev) => new Set([...prev, ...bandIds]))

    try {
      const response = await fetch("/api/admin/bands/bulk-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bandIds,
          imageOnly:
            activeTab === "missing-images" || activeTab === "enrichment-failed",
        }),
      })

      if (!response.ok) throw new Error("Failed to bulk enrich")

      const data = await response.json()
      showToast({
        message: `Enrichment queued for ${data.queued} bands`,
        type: "success",
      })

      // Remove enriched bands from list
      setTimeout(() => {
        setBands((prev) => prev.filter((b) => !selectedIds.has(b.id)))
        setTotal((prev) => prev - data.queued)
        setSelectedIds(new Set())
      }, 1000)
    } catch (error) {
      console.error("Error bulk enriching:", error)
      showToast({ message: "Failed to bulk enrich bands", type: "error" })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        bandIds.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  const handleDelete = async (bandId: string, force: boolean = false) => {
    if (
      !confirm(
        force
          ? "This band has concerts attached. Are you sure you want to delete it?"
          : "Are you sure you want to delete this band?"
      )
    ) {
      return
    }

    setProcessingIds((prev) => new Set(prev).add(bandId))

    try {
      const url = force
        ? `/api/admin/bands/${bandId}?force=true`
        : `/api/admin/bands/${bandId}`

      const response = await fetch(url, { method: "DELETE" })

      if (!response.ok) {
        const data = await response.json()
        if (data.concertCount && !force) {
          // Band has concerts, ask to force delete
          const shouldForce = confirm(
            `This band has ${data.concertCount} concerts attached. Delete anyway?`
          )
          if (shouldForce) {
            handleDelete(bandId, true)
          }
          return
        }
        throw new Error(data.error || "Failed to delete band")
      }

      const data = await response.json()
      showToast({
        message: `Deleted band: ${data.band.name}`,
        type: "success",
      })

      setBands((prev) => prev.filter((b) => b.id !== bandId))
      setTotal((prev) => prev - 1)
    } catch (error) {
      console.error("Error deleting band:", error)
      showToast({
        message:
          error instanceof Error ? error.message : "Failed to delete band",
        type: "error",
      })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(bandId)
        return next
      })
    }
  }

  const toggleSelect = (bandId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(bandId)) {
        next.delete(bandId)
      } else {
        next.add(bandId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === bands.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bands.map((b) => b.id)))
    }
  }

  const focusTabAt = (index: number) => {
    const el = tabRefs.current[index]
    el?.focus()
  }

  const handleTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      const next = (index + 1) % TABS.length
      setActiveTab(TABS[next].id)
      focusTabAt(next)
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      const prev = (index - 1 + TABS.length) % TABS.length
      setActiveTab(TABS[prev].id)
      focusTabAt(prev)
    }
  }

  return (
    <div className="admin-band-mgmt">
      <div className="admin-tabs" role="tablist" aria-label="Band data queues">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            type="button"
            role="tab"
            id={`band-mgmt-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls="band-mgmt-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`admin-tabs__tab ${activeTab === tab.id ? "admin-tabs__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="admin-band-mgmt__panel"
        role="tabpanel"
        id="band-mgmt-panel"
        aria-labelledby={`band-mgmt-tab-${activeTab}`}
      >
        {selectedIds.size > 0 && (
          <div className="admin-bulk-actions">
            <span className="admin-bulk-actions__count">
              {selectedIds.size} selected
            </span>
            {activeTab !== "orphaned" && (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={handleBulkEnrich}
                disabled={processingIds.size > 0}
              >
                Enrich Selected
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </button>
          </div>
        )}

        <div>
          {loading ? (
            <div className="admin-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="admin-list__skeleton" />
              ))}
            </div>
          ) : bands.length === 0 ? (
            <div className="admin-list__empty">
              {activeTab === "missing-images" && "No bands missing images"}
              {activeTab === "enrichment-failed" &&
                "No bands with failed enrichment"}
              {activeTab === "missing-lastfm" &&
                "No bands missing Last.fm data"}
              {activeTab === "orphaned" && "No orphaned bands found"}
            </div>
          ) : (
            <>
              <div className="admin-filter">
                <label>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === bands.length && bands.length > 0
                    }
                    onChange={toggleSelectAll}
                  />{" "}
                  Select all ({total} total)
                </label>
              </div>
              <ul className="admin-list">
                {bands.map((band) => (
                  <li key={band.id} className="admin-list__item">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(band.id)}
                      onChange={() => toggleSelect(band.id)}
                      aria-label={`Select ${band.name}`}
                    />
                    <div className="admin-list__info">
                      <p className="admin-list__name">
                        <Link href={`/band/${band.slug}/`}>{band.name}</Link>
                      </p>
                      <p className="admin-list__meta">
                        {band.concertCount !== undefined &&
                          `${band.concertCount} concerts`}
                        {band.createdBy && ` • Created by ${band.createdBy}`}
                      </p>
                    </div>
                    <div className="admin-list__actions">
                      {activeTab !== "orphaned" && (
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary"
                          onClick={() =>
                            handleEnrich(
                              band.id,
                              activeTab === "missing-images" ||
                                activeTab === "enrichment-failed"
                            )
                          }
                          disabled={processingIds.has(band.id)}
                          aria-label={`Enrich ${band.name}`}
                        >
                          {processingIds.has(band.id) ? "..." : "Enrich"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        onClick={() => handleDelete(band.id)}
                        disabled={processingIds.has(band.id)}
                        aria-label={`Delete ${band.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
