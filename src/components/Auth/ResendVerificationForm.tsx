"use client"

import { useState } from "react"
import { sendVerificationEmail } from "@/lib/auth-client"
import Link from "next/link"
import "./resendVerificationForm.scss"

export default function ResendVerificationForm() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      await sendVerificationEmail({
        email,
        callbackURL: "/",
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
      <div className="resend-form__sent">
        <h2>Check your email</h2>
        <p>
          If an account exists for <strong>{email}</strong>, we sent a new
          verification link.
        </p>
        <Link href="/login" className="resend-form__back">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form className="resend-form" onSubmit={handleSubmit}>
      {error && <div className="resend-form__error">{error}</div>}

      <div className="resend-form__field">
        <label htmlFor="resend-email">Email</label>
        <input
          type="email"
          id="resend-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <button
        type="submit"
        className="resend-form__submit"
        disabled={isLoading}
      >
        {isLoading ? "Sending..." : "Resend Verification Email"}
      </button>

      <p className="resend-form__switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  )
}
