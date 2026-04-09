"use client"

import { useEffect, useRef, useState } from "react"

import { initPostHogIfConsented } from "@/lib/posthog-client"
import { POSTHOG_CONSENT_EVENT, hasPostHogConsent } from "@/lib/posthog-consent"

interface PostHogUserSyncProps {
  userId: string | null
}

/**
 * Links PostHog to the signed-in user using the internal user id only (no email/PII).
 * Calls reset only when transitioning from a known user to logged out (not on every anonymous page load).
 * Re-runs identify when consent is granted so the current user is linked immediately after opt-in.
 */
export default function PostHogUserSync({ userId }: PostHogUserSyncProps) {
  const previousUserId = useRef<string | null | undefined>(undefined)
  const [consentGranted, setConsentGranted] = useState(() => hasPostHogConsent())

  useEffect(() => {
    const handleConsentChange = () => {
      setConsentGranted(hasPostHogConsent())
    }

    window.addEventListener(POSTHOG_CONSENT_EVENT, handleConsentChange)
    return () => {
      window.removeEventListener(POSTHOG_CONSENT_EVENT, handleConsentChange)
    }
  }, [])

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
  }, [userId, consentGranted])

  return null
}
