// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

import { initPostHogIfConsented } from "@/lib/posthog-client"

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

void initPostHogIfConsented().catch((error) => {
  console.error("PostHog initialization failed", error)
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
