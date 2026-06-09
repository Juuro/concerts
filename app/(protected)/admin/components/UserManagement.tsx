"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/Toast/Toast"
import Dialog from "@/components/Dialog/Dialog"
import { DATE_LOCALE } from "@/utils/dateLocale"
import {
  getAccountStatusLabel,
  getAuthProviderLabel,
  type AuthProviderLabel,
  type UserAccountStatus,
} from "@/lib/user-account-status"

interface User {
  id: string
  name: string | null
  email: string
  username: string | null
  image: string | null
  role: string
  banned: boolean
  banReason: string | null
  banExpires: string | null
  emailVerified: boolean
  accountStatus: UserAccountStatus
  authProviderLabel: AuthProviderLabel | null
  passwordResetExpiresAt?: string
  createdAt: string
  concertCount: number
}

type FilterType = "all" | "active" | "banned" | "unverified" | "reset_pending"

type FilterCounts = Record<FilterType, number>

const FILTER_LABELS: Record<FilterType, string> = {
  all: "All Users",
  active: "Active",
  unverified: "Unverified",
  reset_pending: "Reset pending",
  banned: "Banned",
}

const FILTER_EMPTY_MESSAGES: Record<FilterType, string> = {
  all: "No users found",
  active: "No active users",
  banned: "No banned users",
  unverified: "No unverified users",
  reset_pending: "No users with pending password resets",
}

function getStatusBadgeClass(status: UserAccountStatus): string {
  switch (status) {
    case "banned":
      return "admin-badge admin-badge--danger"
    case "reset_pending":
    case "unverified":
      return "admin-badge admin-badge--warning"
    case "active":
      return "admin-badge admin-badge--success"
  }
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [filterCounts, setFilterCounts] = useState<FilterCounts>({
    all: 0,
    active: 0,
    unverified: 0,
    reset_pending: 0,
    banned: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("all")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banDialogUser, setBanDialogUser] = useState<User | null>(null)
  const [banReason, setBanReason] = useState("")
  const [banExpires, setBanExpires] = useState("")
  const { showToast } = useToast()

  const fetchUsers = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/admin/users?filter=${filter}`)
      if (!response.ok) throw new Error("Failed to fetch users")

      const data = await response.json()
      setUsers(data.users)
      if (data.counts) {
        setFilterCounts(data.counts)
      }
    } catch (error) {
      console.error("Error fetching users:", error)
      showToast({ message: "Failed to fetch users", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [filter, showToast])

  // Cleanup expired bans on initial load, then fetch users
  useEffect(() => {
    const init = async () => {
      // Auto-unban expired users before fetching
      try {
        const response = await fetch("/api/admin/users/cleanup-expired-bans", {
          method: "POST",
        })
        if (response.ok) {
          const data = await response.json()
          if (data.unbannedCount > 0) {
            // Notify attention cards to refresh
            window.dispatchEvent(new CustomEvent("admin-data-changed"))
          }
        }
      } catch {
        // Silently ignore cleanup errors
      }
      fetchUsers()
    }
    init()
  }, [fetchUsers])

  const openBanDialog = (user: User) => {
    setBanDialogUser(user)
    setBanReason("")
    setBanExpires("")
    setBanDialogOpen(true)
  }

  const closeBanDialog = () => {
    setBanDialogOpen(false)
    setBanDialogUser(null)
  }

  const handleBan = async () => {
    if (!banDialogUser) return

    setProcessingId(banDialogUser.id)
    closeBanDialog()

    try {
      const response = await fetch(`/api/admin/users/${banDialogUser.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: banReason || undefined,
          expiresAt: banExpires || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to ban user")
      }

      showToast({
        message: `Banned user: ${banDialogUser.name || banDialogUser.email}`,
        type: "success",
      })

      await fetchUsers()

      // Notify other components (e.g., AdminAttention) to refresh
      window.dispatchEvent(new CustomEvent("admin-data-changed"))
    } catch (error) {
      console.error("Error banning user:", error)
      showToast({
        message: error instanceof Error ? error.message : "Failed to ban user",
        type: "error",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const canResendVerification = (user: User) =>
    user.accountStatus === "unverified" &&
    (user.authProviderLabel === "email" || user.authProviderLabel === "both")

  const handleResendVerification = async (user: User) => {
    if (!confirm(`Resend verification email to ${user.name || user.email}?`)) {
      return
    }

    setProcessingId(user.id)

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/resend-verification`,
        { method: "POST" }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to resend verification email")
      }

      showToast({
        message: `Verification email sent to ${user.email}`,
        type: "success",
      })
    } catch (error) {
      console.error("Error resending verification email:", error)
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Failed to resend verification email",
        type: "error",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const handleUnban = async (user: User) => {
    if (!confirm(`Unban ${user.name || user.email}?`)) return

    setProcessingId(user.id)

    try {
      const response = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to unban user")
      }

      showToast({
        message: `Unbanned user: ${user.name || user.email}`,
        type: "success",
      })

      await fetchUsers()

      // Notify other components (e.g., AdminAttention) to refresh
      window.dispatchEvent(new CustomEvent("admin-data-changed"))
    } catch (error) {
      console.error("Error unbanning user:", error)
      showToast({
        message:
          error instanceof Error ? error.message : "Failed to unban user",
        type: "error",
      })
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(DATE_LOCALE)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(DATE_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="admin-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="admin-list__skeleton" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="admin-filter">
        <label className="admin-filter__label" htmlFor="user-filter">
          Filter:
        </label>
        <select
          id="user-filter"
          className="admin-filter__select"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
        >
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((filterType) => (
            <option key={filterType} value={filterType}>
              {FILTER_LABELS[filterType]} ({filterCounts[filterType]})
            </option>
          ))}
        </select>
      </div>

      {users.length === 0 ? (
        <div className="admin-list__empty">{FILTER_EMPTY_MESSAGES[filter]}</div>
      ) : (
        <ul className="admin-list">
          {users.map((user) => (
            <li key={user.id} className="admin-list__item">
              <div className="admin-list__info">
                <p className="admin-list__name">
                  {user.name || "No name"}
                  {user.username && (
                    <span className="admin-list__username">
                      @{user.username}
                    </span>
                  )}
                  <span
                    className={getStatusBadgeClass(user.accountStatus)}
                    role="status"
                    aria-label={`Account status: ${getAccountStatusLabel(user.accountStatus)}`}
                  >
                    {getAccountStatusLabel(user.accountStatus)}
                  </span>
                  {user.authProviderLabel && (
                    <span
                      className="admin-badge admin-badge--auth"
                      aria-label={`Auth method: ${getAuthProviderLabel(user.authProviderLabel)}`}
                    >
                      {getAuthProviderLabel(user.authProviderLabel)}
                    </span>
                  )}
                  {user.role === "admin" && (
                    <span className="admin-badge admin-badge--info">Admin</span>
                  )}
                </p>
                <p className="admin-list__meta">
                  {user.email} • {user.concertCount} concerts • Joined{" "}
                  {formatDate(user.createdAt)}
                </p>
                {user.accountStatus === "reset_pending" &&
                  user.passwordResetExpiresAt && (
                    <p className="admin-list__meta admin-list__meta--reset-expires">
                      Reset link expires:{" "}
                      {formatDateTime(user.passwordResetExpiresAt)}
                    </p>
                  )}
                {user.banned && (
                  <>
                    {user.banReason && (
                      <p className="admin-list__meta admin-list__meta--ban-reason">
                        Reason: {user.banReason}
                      </p>
                    )}
                    {user.banExpires ? (
                      <p className="admin-list__meta admin-list__meta--ban-expires">
                        Expires: {formatDateTime(user.banExpires)}
                      </p>
                    ) : (
                      <p className="admin-list__meta admin-list__meta--ban-permanent">
                        Permanent ban
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="admin-list__actions">
                {canResendVerification(user) && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    onClick={() => handleResendVerification(user)}
                    disabled={processingId === user.id}
                    aria-label={`Resend verification email to ${user.name || user.email}`}
                  >
                    {processingId === user.id ? "..." : "Resend verification"}
                  </button>
                )}
                {user.banned ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    onClick={() => handleUnban(user)}
                    disabled={processingId === user.id}
                    aria-label={`Unban ${user.name || user.email}`}
                  >
                    {processingId === user.id ? "..." : "Unban"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => openBanDialog(user)}
                    disabled={processingId === user.id}
                    aria-label={`Ban ${user.name || user.email}`}
                  >
                    Ban
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={banDialogOpen}
        title={`Ban User: ${banDialogUser?.name || banDialogUser?.email || ""}`}
        onClose={closeBanDialog}
      >
        <div className="admin-confirm-dialog__message">
          <label
            htmlFor="ban-reason"
            style={{ display: "block", marginBottom: 8 }}
          >
            Reason (optional):
          </label>
          <input
            id="ban-reason"
            type="text"
            className="admin-confirm-dialog__input"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Enter reason for ban..."
          />

          <label
            htmlFor="ban-expires"
            style={{ display: "block", marginBottom: 8, marginTop: 16 }}
          >
            Expires (optional):
          </label>
          <input
            id="ban-expires"
            type="datetime-local"
            className="admin-confirm-dialog__input"
            value={banExpires}
            onChange={(e) => setBanExpires(e.target.value)}
          />
        </div>
        <div className="admin-confirm-dialog__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={closeBanDialog}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            onClick={handleBan}
          >
            Ban User
          </button>
        </div>
      </Dialog>
    </div>
  )
}
