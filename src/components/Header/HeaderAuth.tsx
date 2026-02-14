"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { UserMenu } from "../Auth";
import "./headerAuth.scss";

export default function HeaderAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="header-auth header-auth--loading" />;
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="header-auth__login">
        Sign In
      </Link>
    );
  }

  return (
    <div className="header-auth">
      <Link href="/map" className="header-auth__link">
        Map
      </Link>
      <Link href="/dashboard" className="header-auth__link">
        My Concerts
      </Link>
      <UserMenu />
    </div>
  );
}
