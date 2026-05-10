"use client"

import Link from "next/link"
import { useSession } from "@/lib/auth-client"
import { UserMenu } from "../Auth"
import "./headerAuth.scss"

interface HeaderAuthProps {
  showMapLink: boolean
}

export default function HeaderAuth({ showMapLink }: HeaderAuthProps) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <div className="header-auth header-auth--loading" />
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="header-auth__login">
        Sign In
      </Link>
    )
  }

  return (
    <div className="header-auth">
      {showMapLink && (
        <Link href="/map" className="header-auth__link">
          Map
        </Link>
      )}
      {session.user.role === "admin" && (
        <Link href="/admin" className="header-auth__link">
          Admin
        </Link>
      )}
      <UserMenu />
    </div>
  )
}
