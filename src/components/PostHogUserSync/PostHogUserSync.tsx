"use client"

import { useEffect, useRef } from "react"

import { isPostHogAnalyticsEnabled } from "@/lib/posthog-env"

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
    if (!isPostHogAnalyticsEnabled()) return

    import("posthog-js").then(({ default: posthog }) => {
      if (userId) {
        posthog.identify(userId)
      } else if (previousUserId.current) {
        posthog.reset()
      }

      previousUserId.current = userId
    })
  }, [userId])

  return null
}
