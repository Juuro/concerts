"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import Link from "next/link"
import "./forgotPasswordForm.scss"

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })
      setSent(true)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="forgot-form__sent">
        <h2>Check your email</h2>
        <p>
          If an account exists for <strong>{email}</strong>, we sent a password
          reset link.
        </p>
        <Link href="/login" className="forgot-form__back">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form className="forgot-form" onSubmit={handleSubmit}>
      {error && <div className="forgot-form__error">{error}</div>}

      <div className="forgot-form__field">
        <label htmlFor="forgot-email">Email</label>
        <input
          type="email"
          id="forgot-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <button
        type="submit"
        className="forgot-form__submit"
        disabled={isLoading}
      >
        {isLoading ? "Sending..." : "Send Reset Link"}
      </button>

      <p className="forgot-form__switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  )
}
