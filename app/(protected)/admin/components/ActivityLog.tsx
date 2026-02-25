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
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getTargetLink(
  targetType: string,
  targetId: string,
  details: Record<string, unknown> | null
): { href: string; label: string } | null {
  switch (targetType) {
    case "band":
      if (details && typeof details.bandSlug === "string") {
        return {
          href: `/band/${details.bandSlug}/`,
          label: (details.bandName as string) || targetId,
        }
      }
      return null
    case "user":
      return {
        href: "#",
        label: (details?.userName as string) || targetId,
      }
    case "concert":
      return {
        href: "#",
        label: (details?.venue as string) || targetId,
      }
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
      <div className="admin-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="admin-list__skeleton" style={{ height: 40 }} />
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return <div className="admin-list__empty">No recent activity</div>
  }

  return (
    <div className="admin-activity">
      {activities.map((activity) => {
        const actionLabel = ACTION_LABELS[activity.action] || activity.action
        const targetLink = getTargetLink(
          activity.targetType,
          activity.targetId,
          activity.details
        )

        return (
          <div key={activity.id} className="admin-activity__item">
            <span className="admin-activity__time">
              {formatTimeAgo(activity.createdAt)}
            </span>
            <span className="admin-activity__user">{activity.user}</span>
            <span className="admin-activity__action">{actionLabel}</span>
            {targetLink && targetLink.href !== "#" ? (
              <Link href={targetLink.href} className="admin-activity__target">
                {targetLink.label}
              </Link>
            ) : targetLink ? (
              <span className="admin-activity__target">{targetLink.label}</span>
            ) : null}
            {activity.details &&
              typeof activity.details.count === "number" &&
              activity.details.count > 1 && (
                <span style={{ opacity: 0.6, fontSize: "0.75rem" }}>
                  ({activity.details.count} items)
                </span>
              )}
          </div>
        )
      })}
    </div>
  )
}
