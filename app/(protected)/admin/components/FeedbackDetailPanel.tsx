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
      }
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create GitHub issue")
      }

      await load()
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

  if (!feedbackId) {
    return (
      <div className="feedback-detail feedback-detail--empty">
        Select feedback to triage
      </div>
    )
  }

  if (!feedback) {
    return (
      <div className="feedback-detail feedback-detail--empty">
        Loading feedback…
      </div>
    )
  }

  return (
    <div className="feedback-detail">
      <header className="feedback-detail__header">
        <h2>Feedback detail</h2>
        <p>
          #{feedback.id.slice(0, 8)} ·{" "}
          {new Date(feedback.createdAt).toLocaleString()}
        </p>
      </header>

      <p className="feedback-detail__message">{feedback.message}</p>

      <div className="feedback-detail__meta">
        <div>
          <label>Status</label>
          <select
            value={feedback.triageStatus}
            onChange={(e) =>
              patch({
                triageStatus: e.target.value as FeedbackDetail["triageStatus"],
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
          <label>Priority</label>
          <select
            value={feedback.priority}
            onChange={(e) =>
              patch({ priority: e.target.value as FeedbackDetail["priority"] })
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
          <label>Owner</label>
          <select
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

      <div className="feedback-detail__notes">
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

      <section className="feedback-detail__github">
        <h3>GitHub escalation</h3>
        {feedback.githubIssueUrl ? (
          <div className="feedback-detail__github-linked">
            <a href={feedback.githubIssueUrl} target="_blank" rel="noreferrer">
              Linked issue #{feedback.githubIssueNumber}
            </a>
            {feedback.githubProjectItemId ? (
              <p className="feedback-detail__github-project">
                On GitHub project board (Status set).
              </p>
            ) : null}
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
      </section>
    </div>
  )
}
