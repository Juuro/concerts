import { Suspense } from "react"
import { ResetPasswordForm } from "@/components/Auth"
import Link from "next/link"
import "./reset-password.scss"

export const metadata = {
  title: "Reset Password - Concerts",
  description: "Set a new password for your account",
}

export default function ResetPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Reset Password</h1>
        <p className="login-card__subtitle">Enter your new password</p>

        <Suspense>
          <ResetPasswordForm />
        </Suspense>

        <p className="login-card__footer">
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
