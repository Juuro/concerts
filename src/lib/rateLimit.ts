/**
 * Simple in-memory fixed-window rate limiter.
 *
 * Mirrors the established pattern in app/api/feedback/route.ts and
 * app/api/venues/search/route.ts, extracted into a factory so multiple routes
 * can each own an isolated limiter (keyed by userId and/or IP) without sharing
 * counters.
 *
 * LIMITATION: this is per-serverless-instance / per-region, not globally
 * consistent. On a multi-instance deployment the effective ceiling is
 * (instances x max). That is acceptable for the conservative limits used here;
 * the documented upgrade path for strict global limits is a shared store
 * (e.g. Upstash Redis).
 */

export interface RateLimiterOptions {
  /** Window length in milliseconds. */
  windowMs: number
  /** Max allowed requests per key within the window. */
  max: number
  /** Cap on distinct keys held in memory (fail-closed when exceeded). */
  maxEntries?: number
  /** How often to sweep expired entries. */
  cleanupIntervalMs?: number
}

export interface RateLimiter {
  /** Returns true if the request is allowed, false if the limit is exceeded. */
  check(key: string): boolean
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const {
    windowMs,
    max,
    maxEntries = 5000,
    cleanupIntervalMs = 5 * 60 * 1000,
  } = options

  const entries = new Map<string, { count: number; resetAt: number }>()
  let lastCleanupAt = Date.now()

  function cleanupExpired(now: number): void {
    for (const [key, entry] of entries) {
      if (entry.resetAt < now) entries.delete(key)
    }
    lastCleanupAt = now
  }

  return {
    check(key: string): boolean {
      const now = Date.now()

      if (now - lastCleanupAt > cleanupIntervalMs) {
        cleanupExpired(now)
      }

      if (entries.size >= maxEntries && !entries.has(key)) {
        cleanupExpired(now)
        if (entries.size >= maxEntries) {
          // Fail closed: reject new keys when the map is saturated, to prevent
          // bypass via map exhaustion (flooding unique keys).
          return false
        }
      }

      const entry = entries.get(key)
      if (!entry || now > entry.resetAt) {
        entries.set(key, { count: 1, resetAt: now + windowMs })
        return true
      }

      if (entry.count >= max) return false

      entry.count++
      return true
    },
  }
}

/** Best-effort client IP from forwarding headers (matches the venues route). */
export function clientIpFrom(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"
}
