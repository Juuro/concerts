import {
  getPostHogApiHost,
  isPostHogAnalyticsEnabled,
  isPostHogSessionReplayEnabled,
} from "@/lib/posthog-env"
import { hasPostHogConsent } from "@/lib/posthog-consent"

let initPromise: Promise<void> | null = null

function canUsePostHog() {
  return (
    typeof window !== "undefined" &&
    isPostHogAnalyticsEnabled() &&
    hasPostHogConsent()
  )
}

export async function initPostHogIfConsented(): Promise<boolean> {
  if (!canUsePostHog()) return false

  if (!initPromise) {
    initPromise = import("posthog-js")
      .then(({ default: posthog }) => {
        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY!.trim()
        posthog.init(key, {
          api_host: getPostHogApiHost(),
          autocapture: false,
          capture_exceptions: false,
          capture_pageview: "history_change",
          disable_session_recording: !isPostHogSessionReplayEnabled(),
          persistence: "localStorage",
        })
      })
      .catch((error) => {
        initPromise = null
        throw error
      })
  }

  await initPromise
  return true
}

export async function applyPostHogConsentState(consented: boolean) {
  if (!isPostHogAnalyticsEnabled() || typeof window === "undefined") return

  const { default: posthog } = await import("posthog-js")
  if (consented) {
    await initPostHogIfConsented()
    posthog.opt_in_capturing()
    return
  }

  posthog.opt_out_capturing()
  posthog.reset()
}
