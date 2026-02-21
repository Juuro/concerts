"use client"

import { useState } from "react"
import { signUp } from "@/lib/auth-client"
import Link from "next/link"
import "./emailSignUpForm.scss"

interface EmailSignUpFormProps {
  callbackUrl?: string
}

export default function EmailSignUpForm({ callbackUrl = "/" }: EmailSignUpFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        callbackURL: callbackUrl,
      })
      if (result.error) {
        setError(result.error.message || "Failed to create account")
      } else {
        setVerificationSent(true)
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (verificationSent) {
    return (
      <div className="email-form__verification">
        <h2>Check your email</h2>
        <p>
          We sent a verification link to <strong>{email}</strong>. Click the
          link to activate your account.
        </p>
      </div>
    )
  }

  return (
    <form className="email-form" onSubmit={handleSubmit}>
      {error && <div className="email-form__error">{error}</div>}

      <div className="email-form__field">
        <label htmlFor="signup-name">Name</label>
        <input
          type="text"
          id="signup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div className="email-form__field">
        <label htmlFor="signup-email">Email</label>
        <input
          type="email"
          id="signup-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="email-form__field">
        <label htmlFor="signup-password">Password</label>
        <input
          type="password"
          id="signup-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="email-form__field">
        <label htmlFor="signup-confirm-password">Confirm Password</label>
        <input
          type="password"
          id="signup-confirm-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        className="email-form__submit"
        disabled={isLoading}
      >
        {isLoading ? "Creating account..." : "Create Account"}
      </button>

      <p className="email-form__switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  )
}
