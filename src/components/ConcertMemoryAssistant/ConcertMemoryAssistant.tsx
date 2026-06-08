"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toast/Toast"
  CandidateShow,
  ConcertAiSearchResponse,
} from "@/types/concertAiSearch"
import "./concertMemoryAssistant.scss"

const SEARCH_TIMEOUT_MS = 15000
const MIN_PROSE_LENGTH = 3

type AssistantState =
  | { type: "idle" }
  | { type: "thinking" }
  | { type: "results"; candidates: CandidateShow[] }
  | { type: "empty"; hint: string }
  | { type: "error"; message: string }

interface RecentlyAdded {
  key: string
  label: string
  editPath?: string
}

function displayDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function locationLabel(candidate: CandidateShow): string {
  return [candidate.city, candidate.country].filter(Boolean).join(", ")
}

function statusMessage(state: AssistantState): string {
  switch (state.type) {
    case "thinking":
      return "Searching Setlist.fm…"
    case "results":
      return `${state.candidates.length} ${
        state.candidates.length === 1 ? "match" : "matches"
      } found`
    case "empty":
      return "No matches found"
    case "error":
      return "Search failed"
    default:
      return ""
  }
}

export default function ConcertMemoryAssistant() {
  const router = useRouter()
  const { showToast } = useToast()

  const [prose, setProse] = useState("")
  const [state, setState] = useState<AssistantState>({ type: "idle" })
  const [addingId, setAddingId] = useState<string | null>(null)
  const [recentlyAdded, setRecentlyAdded] = useState<RecentlyAdded[]>([])

  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSearch = prose.trim().length >= MIN_PROSE_LENGTH
  const isBusy = state.type === "thinking"

  const runSearch = useCallback(async () => {
    const text = prose.trim()
    if (text.length < MIN_PROSE_LENGTH || isBusy) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, SEARCH_TIMEOUT_MS)

    setState({ type: "thinking" })

    try {
      const res = await fetch("/api/concerts/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prose: text }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const message =
          res.status === 429
            ? "Too many searches — please wait a moment and try again."
            : "Something went wrong searching. Try again, or use the form below."
        setState({ type: "error", message })
        return
      }

      const data = (await res.json()) as ConcertAiSearchResponse
      if (data.candidates.length > 0) {
        setState({ type: "results", candidates: data.candidates })
      } else {
        setState({
          type: "empty",
          hint:
            data.hint ??
            "Nothing found. Try adding a city or an approximate year.",
        })
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        if (timedOut && abortRef.current === controller) {
          setState({
            type: "error",
            message:
              "Search took too long. Try again, or add the concert with the form below.",
          })
        }
        return
      }
      setState({
        type: "error",
        message:
          "Couldn't reach the search. Check your connection and try again.",
      })
    } finally {
      clearTimeout(timeout)
    }
  }, [prose, isBusy])

  const handleAdd = useCallback(
    async (candidate: CandidateShow) => {
      if (addingId || candidate.alreadyAdded) return
      setAddingId(candidate.id)

      try {
        const res = await fetch("/api/concerts/from-setlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setlistId: candidate.id }),
        })
        const data = await res.json().catch(() => ({}))

        if (res.status === 201) {
          const editPath: string | undefined = data?.editPath
          const label =
            data?.summary?.toast ??
            `Added ${candidate.headliner} — ${displayDate(candidate.date)}`
          showToast({
            message: label,
            type: "success",
            duration: 5000,
            action: editPath
              ? { label: "Edit", onClick: () => router.push(editPath) }
              : undefined,
          })
          setRecentlyAdded((prev) => [
            {
              key: candidate.id,
              label: `${candidate.headliner} — ${displayDate(candidate.date)}`,
              editPath,
            },
            ...prev,
          ])
          // Clear for the next entry (fast-backfill loop).
          setProse("")
          setState({ type: "idle" })
          textareaRef.current?.focus()
        } else if (res.status === 409) {
          const editPath: string | undefined = data?.editPath
          setState((prev) =>
            prev.type === "results"
              ? {
                  type: "results",
                  candidates: prev.candidates.map((c) =>
                    c.id === candidate.id
                      ? {
                          ...c,
                          alreadyAdded: true,
                          editPath: editPath ?? c.editPath,
                        }
                      : c
                  ),
                }
              : prev
          )
          showToast({
            message: "That concert is already in your list.",
            type: "info",
          })
        } else {
          showToast({
            message:
              data?.error ?? "Couldn't add that concert. Please try again.",
            type: "error",
          })
        }
      } catch {
        showToast({
          message: "Couldn't add that concert. Check your connection.",
          type: "error",
        })
      } finally {
        setAddingId(null)
      }
    },
    [addingId, router, showToast]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      void runSearch()
    } else if (e.key === "Escape" && state.type !== "idle") {
      setState({ type: "idle" })
    }
  }

  return (
    <section
      className="concert-memory-assistant"
      aria-labelledby="memory-assistant-heading"
    >
      <h2
        id="memory-assistant-heading"
        className="concert-memory-assistant__heading"
      >
        <span aria-hidden="true">✨ </span>
        Help me remember
      </h2>
      <p
        id="memory-assistant-intro"
        className="concert-memory-assistant__intro"
      >
        Describe a concert in your own words and I&apos;ll find the show. Add it
        with one click — you can edit the details later.
      </p>

      <div className="concert-memory-assistant__form">
        <label
          htmlFor="memory-assistant-input"
          className="concert-memory-assistant__label"
        >
          What do you remember?
        </label>
        <textarea
          ref={textareaRef}
          id="memory-assistant-input"
          className="concert-memory-assistant__textarea"
          value={prose}
          onChange={(e) => setProse(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. I saw the Rolling Stones in London, summer '99"
          rows={2}
          maxLength={500}
          disabled={isBusy}
          aria-describedby="memory-assistant-intro memory-assistant-privacy"
        />
        <div className="concert-memory-assistant__actions">
          <button
            type="button"
            className="concert-memory-assistant__submit"
            onClick={() => void runSearch()}
            disabled={!canSearch || isBusy}
          >
            {isBusy ? "Searching…" : "Find concert"}
          </button>
          {isBusy && (
            <span
              className="concert-memory-assistant__thinking"
              aria-hidden="true"
            >
              Searching Setlist.fm…
            </span>
          )}
        </div>
        <p
          id="memory-assistant-privacy"
          className="concert-memory-assistant__privacy"
        >
          Your description is sent to our AI provider (Groq, USA) to find the
          show. It is not stored.{" "}
          <Link href="/privacy" className="concert-memory-assistant__privacy-link">
            Privacy
          </Link>
        </p>
      </div>

      <div
        className="concert-memory-assistant__sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage(state)}
      </div>

      {state.type === "results" && (
        <ul className="concert-memory-assistant__results" role="list">
          {state.candidates.map((candidate) => {
            const place = locationLabel(candidate)
            const isAdding = addingId === candidate.id
            return (
              <li
                key={candidate.id}
                className={`concert-memory-assistant__result${
                  candidate.alreadyAdded
                    ? " concert-memory-assistant__result--added"
                    : ""
                }`}
              >
                <div className="concert-memory-assistant__result-main">
                  <span className="concert-memory-assistant__result-date">
                    {displayDate(candidate.date)}
                  </span>
                  <span className="concert-memory-assistant__result-headliner">
                    {candidate.headliner}
                  </span>
                  {candidate.venue && (
                    <span className="concert-memory-assistant__result-venue">
                      {candidate.venue}
                    </span>
                  )}
                  {place && (
                    <span className="concert-memory-assistant__result-location">
                      {place}
                    </span>
                  )}
                </div>
                {candidate.alreadyAdded ? (
                  <span className="concert-memory-assistant__result-status">
                    Already in your list
                    {candidate.editPath && (
                      <>
                        {" · "}
                        <a
                          href={candidate.editPath}
                          className="concert-memory-assistant__edit-link"
                        >
                          Edit
                        </a>
                      </>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="concert-memory-assistant__add-btn"
                    onClick={() => void handleAdd(candidate)}
                    disabled={isAdding || addingId !== null}
                    aria-label={`Add concert: ${candidate.headliner}${
                      candidate.venue ? ` at ${candidate.venue}` : ""
                    }, ${displayDate(candidate.date)}`}
                  >
                    {isAdding ? "Adding…" : "Add"}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {state.type === "empty" && (
        <div className="concert-memory-assistant__empty">
          <span>{state.hint}</span>
        </div>
      )}

      {state.type === "error" && (
        <div className="concert-memory-assistant__error" role="alert">
          <span>{state.message}</span>
          <button
            type="button"
            className="concert-memory-assistant__error-retry"
            onClick={() => void runSearch()}
          >
            Try again
          </button>
        </div>
      )}

      {recentlyAdded.length > 0 && (
        <section
          className="concert-memory-assistant__recent"
          aria-label="Added this session"
        >
          <h3 className="concert-memory-assistant__recent-title">
            Added this session ({recentlyAdded.length})
          </h3>
          <ul className="concert-memory-assistant__recent-list" role="list">
            {recentlyAdded.map((item) => (
              <li
                key={item.key}
                className="concert-memory-assistant__recent-item"
              >
                <span aria-hidden="true">✓ </span>
                {item.label}
                {item.editPath && (
                  <>
                    {" · "}
                    <a
                      href={item.editPath}
                      className="concert-memory-assistant__edit-link"
                    >
                      Edit
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
