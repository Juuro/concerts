"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import {
  getPostHogConsentState,
  POSTHOG_CONSENT_EVENT,
  setPostHogConsentState,
} from "@/lib/posthog-consent"
import { applyPostHogConsentState } from "@/lib/posthog-client"
import { isPostHogAnalyticsEnabled } from "@/lib/posthog-env"

import "./PostHogConsentBanner.scss"

export default function PostHogConsentBanner() {
  const [isReady, setIsReady] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!isPostHogAnalyticsEnabled()) {
      setIsReady(true)
      return
    }

    setShowBanner(getPostHogConsentState() === null)
    setIsReady(true)

    const handleConsentEvent = () => {
      setShowBanner(getPostHogConsentState() === null)
    }

    window.addEventListener(POSTHOG_CONSENT_EVENT, handleConsentEvent)
    return () => {
      window.removeEventListener(POSTHOG_CONSENT_EVENT, handleConsentEvent)
    }
  }, [])

  const handleConsentChange = async (consented: boolean) => {
    setPostHogConsentState(consented ? "granted" : "denied")

    try {
      await applyPostHogConsentState(consented)
    } catch (error) {
      console.error("Failed to apply PostHog consent state", error)
    } finally {
      setShowBanner(false)
    }
  }

  if (!isReady || !showBanner) return null

  return (
    <aside className="posthog-consent-banner" aria-label="Analytics consent">
      <p className="posthog-consent-banner__text">
        We use analytics and optional session replay to improve reliability and
        usability. This is only active with your consent.
      </p>
      <div className="posthog-consent-banner__actions">
        <button
          className="posthog-consent-banner__button posthog-consent-banner__button--secondary"
          type="button"
          onClick={() => void handleConsentChange(false)}
        >
          Decline
        </button>
        <button
          className="posthog-consent-banner__button posthog-consent-banner__button--primary"
          type="button"
          onClick={() => void handleConsentChange(true)}
        >
          Accept analytics and replay
        </button>
      </div>
      <p className="posthog-consent-banner__meta">
        You can change this anytime in <Link href="/settings">Settings</Link> or
        in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </aside>
  )
}
