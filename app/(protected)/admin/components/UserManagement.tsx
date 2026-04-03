"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/Toast/Toast"
import Dialog from "@/components/Dialog/Dialog"

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
  createdAt: string
  concertCount: number
}

type FilterType = "all" | "active" | "banned"

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
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
      setTotal(data.total)
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

      // Update user in list
      setUsers((prev) =>
        prev.map((u) =>
          u.id === banDialogUser.id
            ? {
                ...u,
                banned: true,
                banReason: banReason || null,
                banExpires: banExpires || null,
              }
            : u
        )
      )

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

      // Update user in list
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, banned: false, banReason: null, banExpires: null }
            : u
        )
      )

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
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
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
          <option value="all">All Users ({total})</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {users.length === 0 ? (
        <div className="admin-list__empty">
          {filter === "banned"
            ? "No banned users"
            : filter === "active"
              ? "No active users"
              : "No users found"}
        </div>
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
                    className={`admin-status-dot ${user.banned ? "admin-status-dot--banned" : "admin-status-dot--active"}`}
                    role="status"
                    aria-label={
                      user.banned
                        ? "Account status: Banned"
                        : "Account status: Active"
                    }
                  >
                    <span className="visually-hidden">
                      {user.banned ? "Banned" : "Active"}
                    </span>
                  </span>
                  {user.role === "admin" && (
                    <span className="admin-badge">Admin</span>
                  )}
                </p>
                <p className="admin-list__meta">
                  {user.email} • {user.concertCount} concerts • Joined{" "}
                  {formatDate(user.createdAt)}
                </p>
                {user.banned && (
                  <>
                    {user.banReason && (
                      <p
                        className="admin-list__meta"
                        style={{ color: "#721c24", marginTop: 4 }}
                      >
                        Reason: {user.banReason}
                      </p>
                    )}
                    {user.banExpires ? (
                      <p
                        className="admin-list__meta"
                        style={{ color: "#856404", marginTop: 4 }}
                      >
                        Expires: {formatDateTime(user.banExpires)}
                      </p>
                    ) : (
                      <p
                        className="admin-list__meta"
                        style={{ color: "#721c24", marginTop: 4 }}
                      >
                        Permanent ban
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="admin-list__actions">
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
