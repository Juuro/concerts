"use client"

import { useEffect, useRef } from "react"

import { initPostHogIfConsented } from "@/lib/posthog-client"

interface PostHogUserSyncProps {
  userId: string | null
}

/**
 * Links PostHog to the signed-in user using the internal user id only (no email/PII).
 * Calls reset only when transitioning from a known user to logged out (not on every anonymous page load).
 */
export default function PostHogUserSync({ userId }: PostHogUserSyncProps) {
  const previousUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    let active = true

    void (async () => {
      const isInitialized = await initPostHogIfConsented()
      if (!active || !isInitialized) return

      const { default: posthog } = await import("posthog-js")
      if (!active) return

      if (userId) {
        posthog.identify(userId)
      } else if (previousUserId.current) {
        posthog.reset()
      }

      previousUserId.current = userId
    })()

    return () => {
      active = false
    }
  }, [userId])

  return null
}
