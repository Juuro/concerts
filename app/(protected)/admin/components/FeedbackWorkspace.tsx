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
    <div className="feedback-ops">
      <div className="admin-page-header">
        <h1 className="admin-page-header__title">Feedback operations</h1>
        <p className="admin-page-header__desc">
          Triage incoming feedback, prioritize fixes, and escalate actionable
          items to GitHub. The <strong>Active</strong> inbox hides completed and
          GitHub-closed items so your queue stays actionable.
        </p>
      </div>

      <div className="feedback-ops__workspace" data-refresh-tick={refreshTick}>
        <FeedbackQueue
          selectedId={selectedId}
          onSelect={setSelectedId}
          refreshTick={refreshTick}
        />
        <FeedbackDetailPanel feedbackId={selectedId} />
      </div>
    </div>
  )
}
