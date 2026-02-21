"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import "./resetPasswordForm.scss"

export default function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="reset-form__error-state">
        <p>Invalid or missing reset token.</p>
        <Link href="/forgot-password">Request a new reset link</Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (result.error) {
        setError(result.error.message || "Failed to reset password")
      } else {
        setSuccess(true)
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="reset-form__success">
        <h2>Password reset</h2>
        <p>Your password has been reset successfully.</p>
        <Link href="/login" className="reset-form__login-link">
          Sign in with your new password
        </Link>
      </div>
    )
  }

  return (
    <form className="reset-form" onSubmit={handleSubmit}>
      {error && <div className="reset-form__error">{error}</div>}

      <div className="reset-form__field">
        <label htmlFor="reset-password">New Password</label>
        <input
          type="password"
          id="reset-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="reset-form__field">
        <label htmlFor="reset-confirm-password">Confirm New Password</label>
        <input
          type="password"
          id="reset-confirm-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        className="reset-form__submit"
        disabled={isLoading}
      >
        {isLoading ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  )
}
