"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

interface SentryUserSetterProps {
  userId: string | null
}

export default function SentryUserSetter({ userId }: SentryUserSetterProps) {
  useEffect(() => {
    Sentry.setUser(userId ? { id: userId } : null)
  }, [userId])

  return null
}
