// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { getPostHogApiHost, isPostHogAnalyticsEnabled } from "@/lib/posthog-env"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Sample 10% of traces in production to control volume and cost
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Only explicit setUser({ id }) identifies users; no default PII (GDPR minimization)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
})

if (isPostHogAnalyticsEnabled()) {
  import("posthog-js").then(({ default: posthog }) => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY!.trim()
    posthog.init(key, {
      api_host: getPostHogApiHost(),
      autocapture: false,
      capture_exceptions: false,
      capture_pageview: "history_change",
      disable_session_recording: true,
      persistence: "localStorage",
    })
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
