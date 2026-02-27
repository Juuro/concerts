"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import type { AttentionStats } from "./AdminAttention"

type Priority = "warning" | "danger" | "success"

interface AttentionItem {
  value: number
  total: number
  label: string
  priority: Priority
  icon: React.ReactNode
  manageHref: string
  manageLabel: string
}

function AttentionCard({
  value,
  total,
  label,
  priority,
  icon,
  manageHref,
  manageLabel,
}: AttentionItem) {
  const progressPercent = total > 0 ? Math.round(((total - value) / total) * 100) : 100
  const needsAction = priority !== "success" && value > 0

  return (
    <div className={`admin-attention-card admin-attention-card--${priority}`}>
      <div className="admin-attention-card__header">
        <div className="admin-attention-card__icon">{icon}</div>
        {needsAction && <div className="admin-attention-card__pulse" />}
      </div>
      <div className="admin-attention-card__value">{value.toLocaleString()}</div>
      <div className="admin-attention-card__label">{label}</div>
      <div className="admin-attention-card__progress">
        <div
          className="admin-attention-card__progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="admin-attention-card__actions">
        {needsAction ? (
          <Link href={manageHref} className="admin-btn admin-btn--primary">
            {manageLabel}
          </Link>
        ) : (
          <span
            style={{
              fontSize: "0.6875rem",
              color: "rgba(0,0,0,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            All clear
          </span>
        )}
      </div>
    </div>
  )
}

function buildAttentionItems(stats: AttentionStats): AttentionItem[] {
  return [
    {
      value: stats.bandsWithoutImages,
      total: stats.totalBands,
      label: "Missing Images",
      priority: stats.bandsWithoutImages > 50 ? "danger" : stats.bandsWithoutImages > 0 ? "warning" : "success",
      manageHref: "/admin?tab=enrichment#management",
      manageLabel: "Manage Bands",
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
    },
    {
      value: stats.concertsWithoutCity,
      total: stats.totalConcerts,
      label: "No City Data",
      priority: stats.concertsWithoutCity > 20 ? "danger" : stats.concertsWithoutCity > 0 ? "warning" : "success",
      manageHref: "/admin?tab=enrichment#management",
      manageLabel: "Manage Concerts",
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
    {
      value: stats.orphanedFestivals,
      total: stats.totalFestivals,
      label: "Orphan Festivals",
      priority: stats.orphanedFestivals > 10 ? "danger" : stats.orphanedFestivals > 0 ? "warning" : "success",
      manageHref: "/admin?tab=cleanup#management",
      manageLabel: "Manage Festivals",
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12a8 8 0 0 1 16 0" />
          <path d="M12 4v4" />
          <path d="M4 12h16" />
          <path d="m8 8 2.8 2.8" />
          <path d="m16 8-2.8 2.8" />
          <path d="M12 20v-8" />
          <path d="M8 20h8" />
        </svg>
      ),
    },
    {
      value: stats.bannedUsers,
      total: stats.totalUsers,
      label: "Banned Users",
      priority: stats.bannedUsers > 5 ? "danger" : stats.bannedUsers > 0 ? "warning" : "success",
      manageHref: "/admin?tab=users#management",
      manageLabel: "Manage Users",
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m4.9 4.9 14.2 14.2" />
        </svg>
      ),
    },
  ]
}

interface AdminAttentionClientProps {
  initialStats: AttentionStats
}

export default function AdminAttentionClient({ initialStats }: AdminAttentionClientProps) {
  const [stats, setStats] = useState<AttentionStats>(initialStats)

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/attention")
      if (!response.ok) return
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Error refreshing attention stats:", error)
    }
  }, [])

  useEffect(() => {
    const handleAdminDataChange = () => {
      fetchStats()
    }

    window.addEventListener("admin-data-changed", handleAdminDataChange)
    return () => window.removeEventListener("admin-data-changed", handleAdminDataChange)
  }, [fetchStats])

  // Cleanup expired bans on mount and refresh stats if any were cleared
  useEffect(() => {
    const cleanupExpiredBans = async () => {
      try {
        const response = await fetch("/api/admin/users/cleanup-expired-bans", {
          method: "POST",
        })
        if (response.ok) {
          const data = await response.json()
          if (data.unbannedCount > 0) {
            fetchStats()
          }
        }
      } catch {
        // Silently ignore cleanup errors
      }
    }
    cleanupExpiredBans()
  }, [fetchStats])

  const attentionItems = buildAttentionItems(stats)

  return (
    <div className="admin-attention-cluster">
      {attentionItems.map((item) => (
        <AttentionCard key={item.label} {...item} />
      ))}
    </div>
  )
}
