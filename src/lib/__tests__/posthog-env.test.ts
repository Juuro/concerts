import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  isPostHogAnalyticsEnabled,
  getPostHogApiHost,
  isPostHogSessionReplayEnabled,
} from "../posthog-env"

describe("posthog-env", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("isPostHogAnalyticsEnabled", () => {
    describe("returns false when key is missing or empty", () => {
      it("returns false when NEXT_PUBLIC_POSTHOG_KEY is undefined", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "true")
        delete process.env.NEXT_PUBLIC_POSTHOG_KEY
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_KEY is empty string", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "true")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_KEY is whitespace only", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "   ")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "true")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })
    })

    describe("returns false when enabled flag is missing or invalid", () => {
      it("returns false when NEXT_PUBLIC_POSTHOG_ENABLED is undefined", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        delete process.env.NEXT_PUBLIC_POSTHOG_ENABLED
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_ENABLED is empty", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_ENABLED is 'false'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "false")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_ENABLED is '0'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "0")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_ENABLED is 'no'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "no")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_ENABLED is unexpected value", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "enabled")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })

      it("returns false when NEXT_PUBLIC_POSTHOG_ENABLED is 'on'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "on")
        expect(isPostHogAnalyticsEnabled()).toBe(false)
      })
    })

    describe("returns true only with valid key and explicit enabled flag", () => {
      it("returns true when key is set and enabled is 'true'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "true")
        expect(isPostHogAnalyticsEnabled()).toBe(true)
      })

      it("returns true when key is set and enabled is '1'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "1")
        expect(isPostHogAnalyticsEnabled()).toBe(true)
      })

      it("returns true when key is set and enabled is 'yes'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "yes")
        expect(isPostHogAnalyticsEnabled()).toBe(true)
      })

      it("returns true with mixed case enabled flag 'TRUE'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "TRUE")
        expect(isPostHogAnalyticsEnabled()).toBe(true)
      })

      it("returns true with mixed case enabled flag 'Yes'", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test123")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "Yes")
        expect(isPostHogAnalyticsEnabled()).toBe(true)
      })

      it("handles key with leading/trailing whitespace", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "  phc_test123  ")
        vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "true")
        expect(isPostHogAnalyticsEnabled()).toBe(true)
      })
    })
  })

  describe("getPostHogApiHost", () => {
    const DEFAULT_EU_HOST = "https://eu.i.posthog.com"

    it("returns default EU host when NEXT_PUBLIC_POSTHOG_HOST is undefined", () => {
      expect(getPostHogApiHost()).toBe(DEFAULT_EU_HOST)
    })

    it("returns default EU host when NEXT_PUBLIC_POSTHOG_HOST is empty", () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "")
      expect(getPostHogApiHost()).toBe(DEFAULT_EU_HOST)
    })

    it("returns default EU host when NEXT_PUBLIC_POSTHOG_HOST is whitespace only", () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "   ")
      expect(getPostHogApiHost()).toBe(DEFAULT_EU_HOST)
    })

    it("returns custom host when NEXT_PUBLIC_POSTHOG_HOST is set", () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com")
      expect(getPostHogApiHost()).toBe("https://us.i.posthog.com")
    })

    it("trims whitespace from custom host", () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "  https://custom.posthog.com  ")
      expect(getPostHogApiHost()).toBe("https://custom.posthog.com")
    })

    it("returns self-hosted URL when configured", () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://analytics.example.com")
      expect(getPostHogApiHost()).toBe("https://analytics.example.com")
    })
  })

  describe("isPostHogSessionReplayEnabled", () => {
    it("returns false when NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED is undefined", () => {
      expect(isPostHogSessionReplayEnabled()).toBe(false)
    })

    it("returns false for disabled values", () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED", "false")
      expect(isPostHogSessionReplayEnabled()).toBe(false)

      vi.stubEnv("NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED", "0")
      expect(isPostHogSessionReplayEnabled()).toBe(false)
    })

    it("returns true for explicit enabled values", () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED", "true")
      expect(isPostHogSessionReplayEnabled()).toBe(true)

      vi.stubEnv("NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED", "1")
      expect(isPostHogSessionReplayEnabled()).toBe(true)

      vi.stubEnv("NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED", "yes")
      expect(isPostHogSessionReplayEnabled()).toBe(true)
    })
  })
})
