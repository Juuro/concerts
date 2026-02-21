"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "@/lib/auth-client"
import "./settings.scss"

export default function SettingsPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [username, setUsername] = useState(session?.user?.username || "")
  const [isPublic, setIsPublic] = useState(session?.user?.isPublic || false)
  const [hideLocationPublic, setHideLocationPublic] = useState(
    session?.user?.hideLocationPublic ?? true
  )
  const [hideCostPublic, setHideCostPublic] = useState(
    session?.user?.hideCostPublic ?? true
  )
  const [currency, setCurrency] = useState(session?.user?.currency || "EUR")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  if (isPending) {
    return (
      <div className="settings">
        <p>Loading...</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, isPublic, currency, hideLocationPublic, hideCostPublic }),
      })

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully!" })
        router.refresh()
      } else {
        const data = await res.json()
        setMessage({
          type: "error",
          text: data.error || "Failed to save settings",
        })
      }
    } catch (err) {
      setMessage({ type: "error", text: "An unexpected error occurred" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="settings">
      <h1>Settings</h1>
      <p className="settings__subtitle">Manage your profile and preferences</p>

      <form className="settings__form" onSubmit={handleSubmit}>
        {message && (
          <div
            className={`settings__message settings__message--${message.type}`}
          >
            {message.text}
          </div>
        )}

        <div className="settings__section">
          <h2>Profile</h2>

          <div className="settings__field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={session?.user?.email || ""}
              disabled
            />
            <span className="settings__hint">Email cannot be changed</span>
          </div>

          <div className="settings__field">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              value={session?.user?.name || ""}
              disabled
            />
          </div>

          <div className="settings__field">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username for your public profile"
              pattern="[a-z0-9-]+"
              title="Only lowercase letters, numbers, and hyphens allowed"
            />
          </div>
        </div>

        <div className="settings__section">
          <h2>Preferences</h2>

          <div className="settings__field">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="SEK">SEK</option>
              <option value="NOK">NOK</option>
              <option value="DKK">DKK</option>
              <option value="CHF">CHF</option>
              <option value="PLN">PLN</option>
              <option value="CZK">CZK</option>
              <option value="HUF">HUF</option>
            </select>
          </div>
        </div>

        <div className="settings__section">
          <h2>Privacy</h2>

          <div className="settings__field settings__checkbox">
            <label>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Make my profile public
            </label>
            <span className="settings__hint">
              When enabled, others can view your concert history at your public
              profile URL
            </span>
          </div>

          <div className={`settings__url-display ${isPublic ? "settings__url-display--visible" : ""}`}>
            <div className="settings__url-display-inner">
              {username ? (
                <>
                  <span className="settings__url-label">Your public profile URL:</span>
                  <div className="settings__url-row">
                    <Link href={`/u/${username}`} className="settings__url-link">
                      /u/{username}
                    </Link>
                    <button
                      type="button"
                      className={`settings__url-copy ${copied ? "settings__url-copy--copied" : ""}`}
                      onClick={() => {
                        navigator.clipboard
                          .writeText(`${window.location.origin}/u/${username}`)
                          .then(() => {
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          })
                      }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </>
              ) : (
                <span className="settings__url-warning">
                  Set a username above to get a public profile URL.
                </span>
              )}
            </div>
          </div>

          <div className={`settings__privacy-options ${isPublic ? "settings__privacy-options--visible" : ""}`}>
            <div className="settings__privacy-options-inner">
              <div className="settings__field settings__checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={hideLocationPublic}
                    onChange={(e) => setHideLocationPublic(e.target.checked)}
                  />
                  Hide location data on public profile
                </label>
                <span className="settings__hint">
                  Venue names, city names, the city statistics chart, the concert map, and dates of future concerts will be hidden from your public profile.
                </span>
                <div className="settings__info-warning">
                  <strong>Privacy note:</strong> Sharing location data for future concerts reveals when you will be at specific venues and when you are not at home. Even just a band name and date is enough to find the exact venue and time. We recommend keeping this enabled.
                </div>
              </div>

              <div className="settings__field settings__checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={hideCostPublic}
                    onChange={(e) => setHideCostPublic(e.target.checked)}
                  />
                  Hide money spent on public profile
                </label>
                <span className="settings__hint">
                  Concert ticket costs will be hidden from your public profile.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="settings__actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
