"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ConcertCard from "../ConcertCard/concertCard"
import ConcertCardSkeleton from "../ConcertCard/ConcertCardSkeleton"
import { useToast } from "../Toast"
import type { TransformedConcert } from "@/lib/concerts"
import "./concertListInfinite.scss"

interface ConcertListInfiniteProps {
  initialConcerts: TransformedConcert[]
  initialNextCursor: string | null
  initialHasMore: boolean
  initialHasPrevious: boolean
  filterParams?: Record<string, string>
  showEditButtons?: boolean
  currentUserId?: string
  hideLocation?: boolean
  hideCost?: boolean
  currency?: string
}

const ConcertListInfinite: React.FC<ConcertListInfiniteProps> = ({
  initialConcerts,
  initialNextCursor,
  initialHasMore,
  initialHasPrevious,
  filterParams = {},
  showEditButtons = false,
  currentUserId,
  hideLocation = false,
  hideCost = false,
  currency,
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const [concerts, setConcerts] =
    useState<TransformedConcert[]>(initialConcerts)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [hasPrevious, setHasPrevious] = useState(initialHasPrevious)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const initialIdsRef = useRef<Set<string>>(new Set(initialConcerts.map((c) => c.id)))

  // Build query string from filter params
  const buildQueryString = useCallback(
    (additionalParams: Record<string, string> = {}) => {
      const params = new URLSearchParams({
        ...filterParams,
        ...additionalParams,
      })
      return params.toString()
    },
    [filterParams]
  )

  // Fetch more concerts (forward direction)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return

    setLoadingMore(true)
    setRetryCount(0)

    const fetchWithRetry = async (attempt: number): Promise<void> => {
      try {
        const queryString = buildQueryString({
          cursor: nextCursor,
          limit: "20",
          direction: "forward",
        })
        const res = await fetch(`/api/concerts?${queryString}`)

        if (!res.ok) throw new Error("Failed to fetch concerts")

        const data = await res.json()

        setConcerts((prev) => [...prev, ...data.items])
        setNextCursor(data.nextCursor)
        setHasMore(data.hasMore)

        // Update URL with the latest cursor for deep linking
        const lastConcertId = data.items[data.items.length - 1]?.id
        if (lastConcertId) {
          const params = new URLSearchParams(searchParams.toString())
          params.set("cursor", lastConcertId)
          router.replace(`?${params.toString()}`, { scroll: false })
        }
      } catch (error) {
        if (attempt === 0) {
          // First failure - retry once automatically
          setRetryCount(1)
          await fetchWithRetry(1)
        } else {
          // Second failure - show toast with manual retry
          showToast({
            message: "Failed to load more concerts",
            type: "error",
            action: {
              label: "Retry",
              onClick: () => loadMore(),
            },
            duration: 0, // Don't auto-dismiss
          })
        }
      }
    }

    await fetchWithRetry(0)
    setLoadingMore(false)
  }, [
    nextCursor,
    hasMore,
    loadingMore,
    router,
    searchParams,
    showToast,
    buildQueryString,
  ])

  // Fetch earlier concerts (backward direction)
  const loadEarlier = useCallback(async () => {
    if (loadingEarlier || !hasPrevious) return

    const firstConcertId = concerts[0]?.id
    if (!firstConcertId) return

    setLoadingEarlier(true)

    const fetchWithRetry = async (attempt: number): Promise<void> => {
      try {
        const queryString = buildQueryString({
          cursor: firstConcertId,
          limit: "20",
          direction: "backward",
        })
        const res = await fetch(`/api/concerts?${queryString}`)

        if (!res.ok) throw new Error("Failed to fetch concerts")

        const data = await res.json()

        setConcerts((prev) => [...data.items, ...prev])
        setHasPrevious(data.hasPrevious)

        // Clear the cursor from URL if we've loaded all previous items
        if (!data.hasPrevious) {
          const params = new URLSearchParams(searchParams.toString())
          params.delete("cursor")
          router.replace(`?${params.toString()}`, { scroll: false })
        }
      } catch (error) {
        if (attempt === 0) {
          await fetchWithRetry(1)
        } else {
          showToast({
            message: "Failed to load earlier concerts",
            type: "error",
            action: {
              label: "Retry",
              onClick: () => loadEarlier(),
            },
            duration: 0,
          })
        }
      }
    }

    await fetchWithRetry(0)
    setLoadingEarlier(false)
  }, [
    concerts,
    hasPrevious,
    loadingEarlier,
    router,
    searchParams,
    showToast,
    buildQueryString,
  ])

  // Set up IntersectionObserver for infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: "200px" }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [loadMore, hasMore, loadingMore])

  // Re-observe when nextCursor changes
  useEffect(() => {
    if (loadMoreRef.current && observerRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }
  }, [nextCursor])

  return (
    <div className="concert-list-infinite">
      {/* Load Earlier Button */}
      {hasPrevious && (
        <div className="concert-list-infinite__load-earlier">
          <button
            type="button"
            onClick={loadEarlier}
            disabled={loadingEarlier}
            className="load-earlier-btn"
          >
            {loadingEarlier ? "Loading..." : "↑ Load earlier concerts"}
          </button>
        </div>
      )}

      {/* Loading earlier skeletons */}
      {loadingEarlier && (
        <ul className="list-unstyled">
          {Array.from({ length: 3 }).map((_, i) => (
            <ConcertCardSkeleton key={`skeleton-earlier-${i}`} />
          ))}
        </ul>
      )}

      {/* Concert List */}
      <ul className="list-unstyled">
        {concerts.map((concert) => (
          <ConcertCard
            key={concert.id}
            concert={concert}
            showEditButton={showEditButtons}
            currentUserId={currentUserId}
            animated={!initialIdsRef.current.has(concert.id)}
            hideLocation={hideLocation}
            hideCost={hideCost}
            currency={currency}
          />
        ))}
      </ul>

      {/* Loading more skeletons */}
      {loadingMore && (
        <ul className="list-unstyled">
          {Array.from({ length: 3 }).map((_, i) => (
            <ConcertCardSkeleton key={`skeleton-more-${i}`} />
          ))}
        </ul>
      )}

      {/* Intersection observer target */}
      <div ref={loadMoreRef} className="concert-list-infinite__sentinel" />

      {/* End of list message */}
      {!hasMore && concerts.length > 0 && (
        <p className="concert-list-infinite__end">No more concerts to load</p>
      )}

      {/* Empty state */}
      {concerts.length === 0 && !loadingMore && (
        <p className="concert-list-infinite__empty">No concerts found</p>
      )}
    </div>
  )
}

export default ConcertListInfinite
