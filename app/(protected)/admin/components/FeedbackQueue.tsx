"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

interface FeedbackItem {
  id: string
  createdAt: string
  updatedAt: string
  category: "BUG" | "FEATURE" | "GENERAL"
  triageStatus: "NEW" | "TRIAGED" | "IN_PROGRESS" | "DONE" | "DISCARDED"
  priority: "P1" | "P2" | "P3" | "P4" | "P5"
  pagePath: string | null
  tags: string[]
  githubIssueNumber: number | null
  githubIssueUrl: string | null
  githubIssueState: "OPEN" | "CLOSED" | null
  githubSyncedAt: string | null
  messagePreview: string
  user: { id: string; email: string; name: string | null } | null
  owner: { id: string; email: string; name: string | null } | null
}

interface FeedbackQueueProps {
  selectedId: string | null
  onSelect: (id: string) => void
  refreshTick?: number
}

const STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "DONE", "DISCARDED"] as const
const PRIORITIES = ["P1", "P2", "P3", "P4", "P5"] as const
const CATEGORIES = ["BUG", "FEATURE", "GENERAL"] as const

type QueueMode = "active" | "all"

export default function FeedbackQueue({
  selectedId,
  onSelect,
  refreshTick,
}: FeedbackQueueProps) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 20
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [status, setStatus] = useState<string>("")
  const [priority, setPriority] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [queueMode, setQueueMode] = useState<QueueMode>("active")

  // Debounce search input: only fire a fetch after the user stops typing for
  // 300ms instead of on every keystroke. Other filters (selects) are immediate.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = q.trim()
      if (trimmed !== debouncedQ) {
        setOffset(0)
        setDebouncedQ(trimmed)
      }
    }, 300)
    return () => clearTimeout(timer)
    // debouncedQ intentionally excluded: we only want to react to raw q changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      queue: queueMode,
    })
    if (debouncedQ) params.set("q", debouncedQ)
    if (status) params.set("status", status)
    if (priority) params.set("priority", priority)
    if (category) params.set("category", category)
    return params.toString()
  }, [category, debouncedQ, limit, offset, priority, queueMode, status])

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/feedback?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch feedback")
      const data = (await response.json()) as {
        items: FeedbackItem[]
        total: number
      }
      setItems(data.items)
      setTotal(data.total)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Refetch when an external update fires (e.g. detail panel save) without
  // remounting the component, so filter state is preserved.
  useEffect(() => {
    if (!refreshTick) return
    fetchQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick])

  useEffect(() => {
    if (items.length === 0) {
      return
    }
    const stillThere = selectedId && items.some((i) => i.id === selectedId)
    if (!stillThere) {
      onSelect(items[0].id)
    }
  }, [items, onSelect, selectedId])

  return (
    <section
      className="feedback-ops__pane feedback-ops__pane--inbox"
      aria-labelledby="feedback-inbox-heading"
    >
      <div className="feedback-ops__pane-head">
        <h2 id="feedback-inbox-heading" className="feedback-ops__pane-title">
          Inbox
        </h2>
        <p className="feedback-ops__pane-desc">
          {queueMode === "active"
            ? "Open work only — excludes Done, Discarded, and GitHub-closed."
            : "Every stored submission, including completed rows."}
        </p>
      </div>

      <div className="feedback-queue__filter-bar">
        <div
          className="feedback-queue__view-toggle"
          role="group"
          aria-label="Queue scope"
        >
          <button
            type="button"
            className={`feedback-queue__toggle${queueMode === "active" ? " feedback-queue__toggle--active" : ""}`}
            aria-pressed={queueMode === "active"}
            onClick={() => {
              setOffset(0)
              setQueueMode("active")
            }}
          >
            Active
          </button>
          <button
            type="button"
            className={`feedback-queue__toggle${queueMode === "all" ? " feedback-queue__toggle--active" : ""}`}
            aria-pressed={queueMode === "all"}
            onClick={() => {
              setOffset(0)
              setQueueMode("all")
            }}
          >
            All
          </button>
        </div>

        <div className="feedback-queue__meta" aria-live="polite">
          {loading
            ? "Loading…"
            : `${total} feedback ${total === 1 ? "item" : "items"}`}
        </div>
      </div>

      <div
        className="feedback-queue__controls"
        role="group"
        aria-label="Feedback filters"
      >
        <input
          id="feedback-q"
          className="feedback-queue__search"
          placeholder="Search message, page, tag"
          aria-label="Search feedback"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
          }}
        />
        <div className="feedback-queue__filter-row">
          <select
            id="feedback-filter-status"
            className={status ? "feedback-queue__select--active" : ""}
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setOffset(0)
              setStatus(e.target.value)
            }}
          >
            <option value="">Any status</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            id="feedback-filter-priority"
            className={priority ? "feedback-queue__select--active" : ""}
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => {
              setOffset(0)
              setPriority(e.target.value)
            }}
          >
            <option value="">Any priority</option>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            id="feedback-filter-category"
            className={category ? "feedback-queue__select--active" : ""}
            aria-label="Filter by category"
            value={category}
            onChange={(e) => {
              setOffset(0)
              setCategory(e.target.value)
            }}
          >
            <option value="">Any category</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="feedback-queue__skeleton" aria-hidden="true" />
      ) : items.length === 0 ? (
        <p className="feedback-queue__empty">
          No feedback matches these filters.
        </p>
      ) : (
        <ul className="feedback-queue__list" aria-label="Feedback queue">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                id={`feedback-item-${item.id}`}
                aria-current={selectedId === item.id ? true : undefined}
                className={`feedback-queue__item${selectedId === item.id ? " feedback-queue__item--active" : ""}`}
                onClick={() => onSelect(item.id)}
              >
                <div className="feedback-queue__item-top">
                  <span className="feedback-chip">{item.category}</span>
                  <span
                    className={`feedback-chip feedback-chip--${item.priority.toLowerCase()}`}
                  >
                    {item.priority}
                  </span>
                  <span className="feedback-chip feedback-chip--muted">
                    {item.triageStatus}
                  </span>
                  {item.githubIssueNumber != null ? (
                    <span
                      className={`feedback-chip feedback-chip--gh${item.githubIssueState === "CLOSED" ? " feedback-chip--gh-closed" : ""}`}
                    >
                      GH #{item.githubIssueNumber}
                      {item.githubIssueState === "CLOSED"
                        ? " · closed"
                        : item.githubIssueState === "OPEN"
                          ? " · open"
                          : ""}
                    </span>
                  ) : null}
                </div>
                <p className="feedback-queue__message">{item.messagePreview}</p>
                <div className="feedback-queue__item-bottom">
                  <span>{item.pagePath || "(no page path)"}</span>
                  <span>{new Date(item.updatedAt).toLocaleString()}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="feedback-queue__pagination">
        <button
          type="button"
          onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
          disabled={offset === 0 || loading}
        >
          Newer
        </button>
        <button
          type="button"
          onClick={() => setOffset((prev) => prev + limit)}
          disabled={offset + limit >= total || loading}
        >
          Older
        </button>
      </div>
    </section>
  )
}
