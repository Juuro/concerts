"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

interface Activity {
  id: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown> | null
  createdAt: string
  user: string
}

const ACTION_LABELS: Record<string, string> = {
  band_enrich: "Enriched band",
  band_bulk_enrich: "Bulk enriched bands",
  band_delete: "Deleted band",
  band_merge: "Merged bands",
  festival_bulk_delete: "Deleted festivals",
  concert_geocode: "Geocoded concert",
  concert_bulk_geocode: "Bulk geocoded concerts",
  user_ban: "Banned user",
  user_unban: "Unbanned user",
  user_auto_unban: "Auto-unbanned user",
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return `${diffSecs}s`
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString()
}

function getTargetInfo(
  action: string,
  targetType: string,
  details: Record<string, unknown> | null
): { href: string | null; label: string } | null {
  switch (targetType) {
    case "band": {
      if (
        action === "band_merge" &&
        details?.sourceBand &&
        details?.targetBand
      ) {
        const source = details.sourceBand as { name: string }
        const target = details.targetBand as { name: string }
        return { href: null, label: `${source.name} → ${target.name}` }
      }
      if (
        action === "band_bulk_enrich" &&
        typeof details?.bandCount === "number"
      ) {
        return { href: null, label: `${details.bandCount} bands` }
      }
      if (details?.bandName) {
        return { href: null, label: details.bandName as string }
      }
      return null
    }
    case "festival": {
      if (typeof details?.count === "number") {
        return { href: null, label: `${details.count} festivals` }
      }
      return null
    }
    case "concert": {
      if (
        action === "concert_bulk_geocode" &&
        typeof details?.count === "number"
      ) {
        return { href: null, label: `${details.count} concerts` }
      }
      if (details?.venue) {
        return { href: null, label: details.venue as string }
      }
      return null
    }
    case "user":
      if (details?.userName) {
        return { href: null, label: details.userName as string }
      }
      return null
    default:
      return null
  }
}

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/activity?limit=15")
      if (!response.ok) throw new Error("Failed to fetch activities")

      const data = await response.json()
      setActivities(data.activities)
    } catch (error) {
      console.error("Error fetching activities:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivities()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000)
    return () => clearInterval(interval)
  }, [fetchActivities])

  if (loading) {
    return (
      <div className="activity-log">
        <ul className="activity-log__list">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className="activity-log__item activity-log__item--skeleton"
            >
              <span className="activity-log__dot" aria-hidden="true" />
              <div className="activity-log__content">
                <span
                  className="admin-list__skeleton"
                  style={{ width: 40, height: 14 }}
                />
                <span
                  className="admin-list__skeleton"
                  style={{ width: 120, height: 14 }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="activity-log">
        <div className="admin-list__empty">No recent activity</div>
      </div>
    )
  }

  return (
    <div className="activity-log">
      <ul className="activity-log__list">
        {activities.map((activity) => {
          const actionLabel = ACTION_LABELS[activity.action] || activity.action
          const targetInfo = getTargetInfo(
            activity.action,
            activity.targetType,
            activity.details
          )

          return (
            <li key={activity.id} className="activity-log__item">
              <span className="activity-log__dot" aria-hidden="true" />
              <div className="activity-log__content">
                <span className="activity-log__time">
                  {formatTimeAgo(activity.createdAt)}
                </span>
                <span className="activity-log__separator" aria-hidden="true">
                  ·
                </span>
                <span className="activity-log__action">{actionLabel}</span>
                {targetInfo && targetInfo.href ? (
                  <Link href={targetInfo.href} className="activity-log__target">
                    {targetInfo.label}
                  </Link>
                ) : targetInfo ? (
                  <span className="activity-log__target">
                    {targetInfo.label}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
