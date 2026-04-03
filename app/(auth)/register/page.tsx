import { AuthButton, EmailSignUpForm } from "@/components/Auth"
import Link from "next/link"
import "./register.scss"

export const metadata = {
  title: "Create Account - Concerts",
  description: "Create an account to track your concert attendance",
}

export default function RegisterPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Create Account</h1>
        <p className="login-card__subtitle">
          Start tracking your concert attendance
        </p>

        <div className="login-card__providers">
          <AuthButton provider="github" />
        </div>

        <div className="login-card__divider">or</div>

        <EmailSignUpForm />

        <p className="login-card__footer">
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
