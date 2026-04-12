"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useToast } from "@/components/Toast/Toast"

interface UserLite {
  id: string
  email: string
  name: string | null
}

interface FeedbackDetail {
  id: string
  createdAt: string
  updatedAt: string
  category: "BUG" | "FEATURE" | "GENERAL"
  triageStatus: "NEW" | "TRIAGED" | "IN_PROGRESS" | "DONE" | "DISCARDED"
  priority: "P1" | "P2" | "P3" | "P4" | "P5"
  message: string
  pagePath: string | null
  userAgent: string | null
  tags: string[]
  internalNotes: string | null
  ownerUserId: string | null
  githubIssueNumber: number | null
  githubIssueUrl: string | null
  githubProjectItemId: string | null
  githubIssueState: "OPEN" | "CLOSED" | null
  githubSyncedAt: string | null
  user: UserLite | null
}

interface FeedbackDetailResponse {
  feedback: FeedbackDetail
  owners: UserLite[]
}

const STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "DONE", "DISCARDED"] as const
const PRIORITIES = ["P1", "P2", "P3", "P4", "P5"] as const

export default function FeedbackDetailPanel({
  feedbackId,
}: {
  feedbackId: string | null
}) {
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null)
  const [owners, setOwners] = useState<UserLite[]>([])
  const [saving, setSaving] = useState(false)
  const [issueLoading, setIssueLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftBody, setDraftBody] = useState("")
  const { showToast } = useToast()

  const load = useCallback(async () => {
    if (!feedbackId) {
      setFeedback(null)
      return
    }

    const res = await fetch(`/api/admin/feedback/${feedbackId}`)
    if (!res.ok) {
      setFeedback(null)
      return
    }
    const data = (await res.json()) as FeedbackDetailResponse
    setFeedback(data.feedback)
    setOwners(data.owners)
  }, [feedbackId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!feedback) return
    setDraftTitle(
      `[Feedback] ${feedback.category}: ${feedback.message.slice(0, 72)}`
    )
    setDraftBody(
      `Reported from: ${feedback.pagePath || "unknown"}\n\nSummary:\n${feedback.message}`
    )
  }, [feedback])

  const ownerOptions = useMemo(() => owners, [owners])

  const patch = async (next: Partial<FeedbackDetail>) => {
    if (!feedback) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/feedback/${feedback.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error("Failed to update feedback")
      const data = (await res.json()) as { feedback: FeedbackDetail }
      setFeedback(data.feedback)
      showToast({ message: "Feedback updated", type: "success" })
      window.dispatchEvent(new CustomEvent("admin-feedback-updated"))
    } catch {
      showToast({ message: "Could not update feedback", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const createGithubIssue = async () => {
    if (!feedback) return
    setIssueLoading(true)
    try {
      const res = await fetch(`/api/admin/feedback/${feedback.id}/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          body: draftBody,
          labels: ["feedback", `category:${feedback.category.toLowerCase()}`],
          includeOriginalMessage: false,
        }),
      })

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        projectLinkError?: string
        feedback?: FeedbackDetail
      }
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create GitHub issue")
      }

      if (payload.feedback) {
        setFeedback(payload.feedback)
      } else {
        await load()
      }
      showToast({ message: "GitHub issue created", type: "success" })
      if (payload.projectLinkError) {
        showToast({
          message: `Issue created but project board link failed: ${payload.projectLinkError}`,
          type: "info",
          duration: 8000,
        })
      }
      window.dispatchEvent(new CustomEvent("admin-feedback-updated"))
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "GitHub issue failed",
        type: "error",
      })
    } finally {
      setIssueLoading(false)
    }
  }

  const syncGithubIssue = async () => {
    if (!feedback?.githubIssueNumber) return
    setSyncLoading(true)
    try {
      const res = await fetch(
        `/api/admin/feedback/${feedback.id}/github/sync`,
        { method: "POST" }
      )
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        feedback?: FeedbackDetail
        autoDoneApplied?: boolean
      }
      if (!res.ok) {
        throw new Error(payload.error || "Sync failed")
      }
      if (payload.feedback) {
        setFeedback(payload.feedback)
      } else {
        await load()
      }
      showToast({
        message: payload.autoDoneApplied
          ? "GitHub state synced — marked Done (auto-close rule)."
          : "GitHub issue state updated",
        type: "success",
      })
      window.dispatchEvent(new CustomEvent("admin-feedback-updated"))
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Sync failed",
        type: "error",
      })
    } finally {
      setSyncLoading(false)
    }
  }

  const githubStatusLabel = useMemo(() => {
    if (!feedback?.githubIssueUrl) return null
    if (feedback.githubIssueState === "CLOSED") return "Closed on GitHub"
    if (feedback.githubIssueState === "OPEN") return "Open on GitHub"
    return "GitHub — not synced yet"
  }, [feedback])

  if (!feedbackId) {
    return (
      <section
        className="feedback-ops__pane feedback-ops__pane--detail feedback-detail feedback-detail--empty"
        aria-label="Feedback detail"
      >
        <p>Select an item from the inbox to triage.</p>
      </section>
    )
  }

  if (!feedback) {
    return (
      <section
        className="feedback-ops__pane feedback-ops__pane--detail feedback-detail feedback-detail--empty"
        aria-label="Feedback detail"
      >
        <p aria-live="polite">Loading feedback…</p>
      </section>
    )
  }

  return (
    <section
      className="feedback-ops__pane feedback-ops__pane--detail feedback-detail"
      aria-labelledby="feedback-detail-heading"
    >
      <header className="feedback-detail__header">
        <h2 id="feedback-detail-heading" className="feedback-detail__title">
          Detail
        </h2>
        <p className="feedback-detail__idline">
          #{feedback.id.slice(0, 8)} ·{" "}
          {new Date(feedback.createdAt).toLocaleString()}
        </p>
      </header>

      <div className="feedback-detail__section">
        <h3 className="feedback-detail__section-label">Message</h3>
        <p className="feedback-detail__message">{feedback.message}</p>
      </div>

      <div className="feedback-detail__section">
        <h3 className="feedback-detail__section-label">Triage</h3>
        <div className="feedback-detail__meta">
          <div>
            <label htmlFor="fb-status">Status</label>
            <select
              id="fb-status"
              value={feedback.triageStatus}
              onChange={(e) =>
                patch({
                  triageStatus: e.target
                    .value as FeedbackDetail["triageStatus"],
                })
              }
              disabled={saving}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fb-priority">Priority</label>
            <select
              id="fb-priority"
              value={feedback.priority}
              onChange={(e) =>
                patch({
                  priority: e.target.value as FeedbackDetail["priority"],
                })
              }
              disabled={saving}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fb-owner">Owner</label>
            <select
              id="fb-owner"
              value={feedback.ownerUserId || ""}
              onChange={(e) => patch({ ownerUserId: e.target.value || null })}
              disabled={saving}
            >
              <option value="">Unassigned</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name || owner.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="feedback-detail__section feedback-detail__notes">
        <label htmlFor="feedback-notes">Internal notes</label>
        <textarea
          id="feedback-notes"
          value={feedback.internalNotes || ""}
          onChange={(e) =>
            setFeedback((prev) =>
              prev ? { ...prev, internalNotes: e.target.value } : prev
            )
          }
          rows={5}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            patch({ internalNotes: feedback.internalNotes || null })
          }
        >
          Save notes
        </button>
      </div>

      <div className="feedback-detail__section feedback-detail__github">
        <div className="feedback-detail__github-head">
          <h3 className="feedback-detail__section-label">GitHub</h3>
          {feedback.githubIssueUrl ? (
            <span
              className={`feedback-detail__gh-pill${feedback.githubIssueState === "CLOSED" ? " feedback-detail__gh-pill--closed" : feedback.githubIssueState === "OPEN" ? " feedback-detail__gh-pill--open" : " feedback-detail__gh-pill--unknown"}`}
            >
              {githubStatusLabel}
            </span>
          ) : null}
        </div>

        {feedback.githubIssueUrl ? (
          <div className="feedback-detail__github-body">
            <a
              href={feedback.githubIssueUrl}
              target="_blank"
              rel="noreferrer"
              className="feedback-detail__gh-link"
            >
              Issue #{feedback.githubIssueNumber}
            </a>
            {feedback.githubSyncedAt ? (
              <p className="feedback-detail__gh-synced">
                Last synced {new Date(feedback.githubSyncedAt).toLocaleString()}
              </p>
            ) : (
              <p className="feedback-detail__gh-synced">
                Not synced yet — refresh to load state from GitHub.
              </p>
            )}
            {feedback.githubProjectItemId ? (
              <p className="feedback-detail__github-project">
                On your GitHub project board (Status field set when linked).
              </p>
            ) : null}
            <button
              type="button"
              className="feedback-detail__gh-refresh"
              disabled={syncLoading}
              onClick={syncGithubIssue}
            >
              {syncLoading ? "Syncing…" : "Refresh from GitHub"}
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="github-title">Issue title</label>
            <input
              id="github-title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
            <label htmlFor="github-body">Issue body</label>
            <textarea
              id="github-body"
              rows={6}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
            />
            <button
              type="button"
              disabled={issueLoading}
              onClick={createGithubIssue}
            >
              {issueLoading ? "Creating issue…" : "Create GitHub issue"}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
