"use client"

import Link from "next/link"
import { useState, useSyncExternalStore } from "react"

import {
  getPostHogConsentState,
  POSTHOG_CONSENT_EVENT,
  setPostHogConsentState,
} from "@/lib/posthog-consent"
import { applyPostHogConsentState } from "@/lib/posthog-client"
import {
  isPostHogAnalyticsEnabled,
  isPostHogSessionReplayEnabled,
} from "@/lib/posthog-env"

import "./PostHogConsentBanner.scss"

function subscribeToConsentChanges(callback: () => void) {
  window.addEventListener(POSTHOG_CONSENT_EVENT, callback)
  return () => window.removeEventListener(POSTHOG_CONSENT_EVENT, callback)
}

function getConsentSnapshot() {
  return getPostHogConsentState()
}

function getServerSnapshot() {
  return null
}

export default function PostHogConsentBanner() {
  const consentState = useSyncExternalStore(
    subscribeToConsentChanges,
    getConsentSnapshot,
    getServerSnapshot
  )
  const [error, setError] = useState<string | null>(null)

  const analyticsEnabled = isPostHogAnalyticsEnabled()
  const showBanner = analyticsEnabled && consentState === null

  const handleConsentChange = async (consented: boolean) => {
    setError(null)

    const persisted = setPostHogConsentState(consented ? "granted" : "denied")
    if (!persisted) {
      setError(
        "Could not save your preference. Please check your browser settings."
      )
      return
    }

    try {
      await applyPostHogConsentState(consented)
    } catch (err) {
      console.error("Failed to apply PostHog consent state", err)
      setError("Something went wrong. Please try again.")
    }
  }

  if (!showBanner) return null

  const replayEnabled = isPostHogSessionReplayEnabled()
  const acceptLabel = replayEnabled
    ? "Accept analytics and replay"
    : "Accept analytics"

  return (
    <aside className="posthog-consent-banner" aria-label="Analytics consent">
      <p className="posthog-consent-banner__text">
        We use analytics{replayEnabled ? " and optional session replay" : ""} to
        improve reliability and usability. This is only active with your
        consent.
      </p>
      {error && (
        <p className="posthog-consent-banner__error" role="alert">
          {error}
        </p>
      )}
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
          {acceptLabel}
        </button>
      </div>
      <p className="posthog-consent-banner__meta">
        You can change this anytime in <Link href="/settings">Settings</Link> or
        in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </aside>
  )
}
