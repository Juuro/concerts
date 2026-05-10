import Link from "next/link"
import "./verify-email.scss"

export const metadata = {
  title: "Email Verified - Concerts",
  description: "Your email has been verified",
}

export default function VerifyEmailPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Email Verified</h1>
        <p className="login-card__subtitle">
          Your email has been verified successfully. You can now sign in to your
          account.
        </p>

        <div className="verify-email__actions">
          <Link href="/login" className="verify-email__link">
            Sign In
          </Link>
        </div>

        <p className="login-card__footer">
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
