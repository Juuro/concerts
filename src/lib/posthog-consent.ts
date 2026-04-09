export const POSTHOG_CONSENT_STORAGE_KEY = "concerts_posthog_consent_v1"
export const POSTHOG_CONSENT_EVENT = "concerts:posthog-consent-changed"

export type PostHogConsentState = "granted" | "denied" | null

export function getPostHogConsentState(): PostHogConsentState {
  if (typeof window === "undefined") return null

  const value = window.localStorage.getItem(POSTHOG_CONSENT_STORAGE_KEY)
  if (value === "granted" || value === "denied") return value
  return null
}

export function hasPostHogConsent(): boolean {
  return getPostHogConsentState() === "granted"
}

export function setPostHogConsentState(
  state: Exclude<PostHogConsentState, null>
) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(POSTHOG_CONSENT_STORAGE_KEY, state)
  window.dispatchEvent(new Event(POSTHOG_CONSENT_EVENT))
}
