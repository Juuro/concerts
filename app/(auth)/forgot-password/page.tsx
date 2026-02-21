import { ForgotPasswordForm } from "@/components/Auth"
import Link from "next/link"
import "./forgot-password.scss"

export const metadata = {
  title: "Forgot Password - Concerts",
  description: "Reset your password",
}

export default function ForgotPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Forgot Password</h1>
        <p className="login-card__subtitle">
          Enter your email and we&apos;ll send you a reset link
        </p>

        <ForgotPasswordForm />

        <p className="login-card__footer">
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
