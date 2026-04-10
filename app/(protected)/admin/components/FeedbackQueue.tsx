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
  messagePreview: string
  user: { id: string; email: string; name: string | null } | null
  owner: { id: string; email: string; name: string | null } | null
}

interface FeedbackQueueProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "DONE", "DISCARDED"] as const
const PRIORITIES = ["P1", "P2", "P3", "P4", "P5"] as const
const CATEGORIES = ["BUG", "FEATURE", "GENERAL"] as const

export default function FeedbackQueue({
  selectedId,
  onSelect,
}: FeedbackQueueProps) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(20)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<string>("")
  const [priority, setPriority] = useState<string>("")
  const [category, setCategory] = useState<string>("")

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })
    if (q.trim()) params.set("q", q.trim())
    if (status) params.set("status", status)
    if (priority) params.set("priority", priority)
    if (category) params.set("category", category)
    return params.toString()
  }, [category, limit, offset, priority, q, status])

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
      if (!selectedId && data.items.length > 0) {
        onSelect(data.items[0].id)
      }
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [onSelect, queryString, selectedId])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  return (
    <div className="feedback-queue">
      <div className="feedback-queue__controls">
        <input
          className="feedback-queue__search"
          placeholder="Search message, page, tag"
          value={q}
          onChange={(e) => {
            setOffset(0)
            setQ(e.target.value)
          }}
          aria-label="Search feedback"
        />
        <select
          value={status}
          onChange={(e) => {
            setOffset(0)
            setStatus(e.target.value)
          }}
        >
          <option value="">All status</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => {
            setOffset(0)
            setPriority(e.target.value)
          }}
        >
          <option value="">All priority</option>
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setOffset(0)
            setCategory(e.target.value)
          }}
        >
          <option value="">All category</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="feedback-queue__meta">{total} feedback items</div>

      {loading ? (
        <div className="admin-list__skeleton" />
      ) : (
        <ul
          className="feedback-queue__list"
          role="listbox"
          aria-label="Feedback queue"
        >
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
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
          disabled={offset === 0}
        >
          Newer
        </button>
        <button
          type="button"
          onClick={() => setOffset((prev) => prev + limit)}
          disabled={offset + limit >= total}
        >
          Older
        </button>
      </div>
    </div>
  )
}
