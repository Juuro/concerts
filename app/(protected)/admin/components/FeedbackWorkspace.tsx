"use client"

import { useEffect, useState } from "react"
import FeedbackQueue from "./FeedbackQueue"
import FeedbackDetailPanel from "./FeedbackDetailPanel"

export default function FeedbackWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const onUpdated = () => setRefreshTick((prev) => prev + 1)
    window.addEventListener("admin-feedback-updated", onUpdated)
    return () => window.removeEventListener("admin-feedback-updated", onUpdated)
  }, [])

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-header__title">Feedback Operations</h1>
        <p className="admin-page-header__desc">
          Triage incoming feedback, prioritize fixes, and escalate actionable
          items to GitHub.
        </p>
      </div>

      <section
        className="admin-card"
        aria-labelledby="feedback-workspace-heading"
      >
        <div className="admin-card__header">
          <h2 id="feedback-workspace-heading" className="admin-card__title">
            Feedback Workspace
          </h2>
        </div>

        <div className="feedback-workspace" data-refresh-tick={refreshTick}>
          <FeedbackQueue
            key={refreshTick}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <FeedbackDetailPanel feedbackId={selectedId} />
        </div>
      </section>
    </>
  )
}
