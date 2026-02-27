"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import "./banned.scss"

interface BannedClientProps {
  reason: string | null
  expiresAt: string | null
}

export default function BannedClient({ reason, expiresAt }: BannedClientProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/login")
  }

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="banned-page">
      <div className="banned-page__card">
        <div className="banned-page__icon">
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
        </div>

        <h1 className="banned-page__title">Account Suspended</h1>

        <p className="banned-page__message">
          Your account has been temporarily suspended by an administrator.
        </p>

        {reason && (
          <div className="banned-page__reason">
            <strong>Reason:</strong> {reason}
          </div>
        )}

        {expiresAt && (
          <div className="banned-page__expiry">
            <strong>Your access will be restored on:</strong>
            <br />
            {formatExpirationDate(expiresAt)}
          </div>
        )}

        {!expiresAt && (
          <p className="banned-page__permanent">
            This suspension is permanent. If you believe this is an error, please
            contact support.
          </p>
        )}

        <button
          type="button"
          className="banned-page__logout"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
