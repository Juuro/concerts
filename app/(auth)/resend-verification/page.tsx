import { ResendVerificationForm } from "@/components/Auth"
import Link from "next/link"
import "./resend-verification.scss"

export const metadata = {
  title: "Resend Verification Email - Concerts",
  description: "Resend your email verification link",
}

export default function ResendVerificationPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Resend Verification Email</h1>
        <p className="login-card__subtitle">
          Enter your email and we&apos;ll send you a new verification link
        </p>

        <ResendVerificationForm />

        <p className="login-card__footer">
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
