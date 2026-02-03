"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import "./settings.scss"

export default function SettingsPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [username, setUsername] = useState(session?.user?.username || "")
  const [isPublic, setIsPublic] = useState(session?.user?.isPublic || false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

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
        body: JSON.stringify({ username, isPublic }),
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
            <span className="settings__hint">
              Your public profile URL will be: /u/{username || "username"}
            </span>
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
