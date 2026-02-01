import { AuthButton } from "@/components/Auth";
import Link from "next/link";
import "./login.scss";

export const metadata = {
  title: "Sign In - Concerts",
  description: "Sign in to track your concert attendance",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Welcome Back</h1>
        <p className="login-card__subtitle">Sign in to track your concert attendance</p>

        <div className="login-card__providers">
          <AuthButton provider="github" />
        </div>

        <p className="login-card__footer">
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
