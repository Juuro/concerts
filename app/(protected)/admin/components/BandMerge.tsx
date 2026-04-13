"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useToast } from "@/components/Toast/Toast"

interface Band {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  concertCount: number
  genres: string[]
}

interface DuplicatePair {
  band1: Band
  band2: Band
  similarity: number
}

export default function BandMerge() {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([])
  const [loading, setLoading] = useState(true)
  const [processingPair, setProcessingPair] = useState<string | null>(null)
  const { showToast } = useToast()

  const fetchDuplicates = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/bands/duplicates")
      if (!response.ok) throw new Error("Failed to fetch duplicates")

      const data = await response.json()
      setDuplicates(data.duplicates)
    } catch (error) {
      console.error("Error fetching duplicates:", error)
      showToast({ message: "Failed to fetch duplicates", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchDuplicates()
  }, [fetchDuplicates])

  const handleMerge = async (sourceId: string, targetId: string) => {
    const pairKey = `${sourceId}-${targetId}`
    setProcessingPair(pairKey)

    try {
      const response = await fetch("/api/admin/bands/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, targetId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to merge bands")
      }

      const data = await response.json()
      showToast({
        message: `Merged "${data.merged.source.name}" into "${data.merged.target.name}"`,
        type: "success",
      })

      // Remove this pair from the list
      setDuplicates((prev) =>
        prev.filter(
          (p) =>
            !(p.band1.id === sourceId || p.band2.id === sourceId) &&
            !(p.band1.id === targetId && p.band2.id === sourceId)
        )
      )
    } catch (error) {
      console.error("Error merging bands:", error)
      showToast({
        message:
          error instanceof Error ? error.message : "Failed to merge bands",
        type: "error",
      })
    } finally {
      setProcessingPair(null)
    }
  }

  const handleDismiss = (band1Id: string, band2Id: string) => {
    // Remove from local state (doesn't persist - just hides for this session)
    setDuplicates((prev) =>
      prev.filter(
        (p) =>
          !(
            (p.band1.id === band1Id && p.band2.id === band2Id) ||
            (p.band1.id === band2Id && p.band2.id === band1Id)
          )
      )
    )
    showToast({ message: "Pair dismissed", type: "info" })
  }

  if (loading) {
    return (
      <div className="admin-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="admin-list__skeleton admin-merge__skeleton" />
        ))}
      </div>
    )
  }

  if (duplicates.length === 0) {
    return (
      <div className="admin-list__empty">
        No potential duplicate bands found
      </div>
    )
  }

  return (
    <div>
      <p className="admin-merge__intro">
        Found {duplicates.length} potential duplicate pairs. Review and merge as
        needed.
      </p>

      {duplicates.map((pair) => {
        const pairKey1 = `${pair.band1.id}-${pair.band2.id}`
        const pairKey2 = `${pair.band2.id}-${pair.band1.id}`
        const isProcessing =
          processingPair === pairKey1 || processingPair === pairKey2

        return (
          <div key={pairKey1} className="admin-merge__pair">
            <div className="admin-merge__band">
              <p className="admin-merge__name">
                <Link href={`/band/${pair.band1.slug}/`}>
                  {pair.band1.name}
                </Link>
              </p>
              <p className="admin-merge__meta">
                {pair.band1.concertCount} concerts
                {pair.band1.genres.length > 0 && (
                  <> • {pair.band1.genres.slice(0, 2).join(", ")}</>
                )}
              </p>
              <div className="admin-merge__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => handleMerge(pair.band2.id, pair.band1.id)}
                  disabled={isProcessing}
                  aria-label={`Keep ${pair.band1.name}, merge ${pair.band2.name} into it`}
                >
                  Keep This
                </button>
              </div>
            </div>

            <div className="admin-merge__arrow">
              <span title={`${Math.round(pair.similarity * 100)}% similar`}>
                {Math.round(pair.similarity * 100)}%
              </span>
            </div>

            <div className="admin-merge__band">
              <p className="admin-merge__name">
                <Link href={`/band/${pair.band2.slug}/`}>
                  {pair.band2.name}
                </Link>
              </p>
              <p className="admin-merge__meta">
                {pair.band2.concertCount} concerts
                {pair.band2.genres.length > 0 && (
                  <> • {pair.band2.genres.slice(0, 2).join(", ")}</>
                )}
              </p>
              <div className="admin-merge__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => handleMerge(pair.band1.id, pair.band2.id)}
                  disabled={isProcessing}
                  aria-label={`Keep ${pair.band2.name}, merge ${pair.band1.name} into it`}
                >
                  Keep This
                </button>
              </div>
            </div>

            <div className="admin-merge__dismiss">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => handleDismiss(pair.band1.id, pair.band2.id)}
                disabled={isProcessing}
              >
                Not Duplicates
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
