import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { createRateLimiter, clientIpFrom } from "@/lib/rateLimit"

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test("allows up to `max` requests per key within the window", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 })
    expect(limiter.check("a")).toBe(true)
    expect(limiter.check("a")).toBe(true)
    expect(limiter.check("a")).toBe(true)
    expect(limiter.check("a")).toBe(false)
  })

  test("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    expect(limiter.check("a")).toBe(true)
    expect(limiter.check("b")).toBe(true)
    expect(limiter.check("a")).toBe(false)
  })

  test("resets after the window elapses", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 })
    expect(limiter.check("a")).toBe(true)
    expect(limiter.check("a")).toBe(false)
    vi.advanceTimersByTime(60_001)
    expect(limiter.check("a")).toBe(true)
  })

  test("fails closed when the key map is saturated with active entries", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 5,
      maxEntries: 2,
    })
    expect(limiter.check("a")).toBe(true)
    expect(limiter.check("b")).toBe(true)
    // Map is full of non-expired entries; a brand-new key is rejected.
    expect(limiter.check("c")).toBe(false)
    // Existing keys still work.
    expect(limiter.check("a")).toBe(true)
  })
})

describe("clientIpFrom", () => {
  test("takes the first x-forwarded-for entry", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18",
    })
    expect(clientIpFrom(headers)).toBe("203.0.113.7")
  })

  test("falls back to 'anonymous' when absent", () => {
    expect(clientIpFrom(new Headers())).toBe("anonymous")
  })
})
