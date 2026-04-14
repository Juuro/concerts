/**
 * PostHog is opt-in: requires a project key and explicit NEXT_PUBLIC_POSTHOG_ENABLED.
 * Keeps local/preview builds from sending events unless configured.
 */
export function isPostHogAnalyticsEnabled(): boolean {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  if (!key) return false
  const flag = process.env.NEXT_PUBLIC_POSTHOG_ENABLED?.toLowerCase()
  return flag === "true" || flag === "1" || flag === "yes"
}

export function getPostHogApiHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com"
  )
}

/**
 * Session replay is opt-in behind an explicit env flag.
 * Keep disabled by default until legal and UX controls are in place.
 */
export function isPostHogSessionReplayEnabled(): boolean {
  const flag =
    process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED?.toLowerCase()
  return flag === "true" || flag === "1" || flag === "yes"
}
