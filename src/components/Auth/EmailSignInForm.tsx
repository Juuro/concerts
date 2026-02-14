"use client"

import { useState } from "react"
import { signIn } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import "./emailSignInForm.scss"

interface EmailSignInFormProps {
  callbackUrl?: string
}

export default function EmailSignInForm({ callbackUrl = "/dashboard" }: EmailSignInFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn.email({ email, password })
      if (result.error) {
        setError(result.error.message || "Invalid email or password")
      } else {
        router.push(callbackUrl)
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className="email-form" onSubmit={handleSubmit}>
      {error && <div className="email-form__error">{error}</div>}

      <div className="email-form__field">
        <label htmlFor="signin-email">Email</label>
        <input
          type="email"
          id="signin-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="email-form__field">
        <label htmlFor="signin-password">Password</label>
        <input
          type="password"
          id="signin-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="current-password"
        />
      </div>

      <div className="email-form__forgot">
        <Link href="/forgot-password">Forgot password?</Link>
      </div>

      <button
        type="submit"
        className="email-form__submit"
        disabled={isLoading}
      >
        {isLoading ? "Signing in..." : "Sign In"}
      </button>

      <p className="email-form__switch">
        Don&apos;t have an account? <Link href="/register">Sign up</Link>
      </p>
    </form>
  )
}
