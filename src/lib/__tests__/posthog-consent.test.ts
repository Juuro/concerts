import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  POSTHOG_CONSENT_STORAGE_KEY,
  POSTHOG_CONSENT_EVENT,
  getPostHogConsentState,
  hasPostHogConsent,
  setPostHogConsentState,
} from "../posthog-consent"

describe("posthog-consent", () => {
  const originalWindow = global.window

  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
      dispatchEvent: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalWindow === undefined) {
      // @ts-expect-error - resetting window for SSR tests
      delete global.window
    }
  })

  describe("constants", () => {
    it("exports correct storage key", () => {
      expect(POSTHOG_CONSENT_STORAGE_KEY).toBe("concerts_posthog_consent_v1")
    })

    it("exports correct event name", () => {
      expect(POSTHOG_CONSENT_EVENT).toBe("concerts:posthog-consent-changed")
    })
  })

  describe("getPostHogConsentState", () => {
    it("returns null when window is undefined (SSR)", () => {
      vi.stubGlobal("window", undefined)
      expect(getPostHogConsentState()).toBeNull()
    })

    it("returns 'granted' when localStorage has 'granted'", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue("granted")
      expect(getPostHogConsentState()).toBe("granted")
      expect(window.localStorage.getItem).toHaveBeenCalledWith(
        POSTHOG_CONSENT_STORAGE_KEY
      )
    })

    it("returns 'denied' when localStorage has 'denied'", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue("denied")
      expect(getPostHogConsentState()).toBe("denied")
    })

    it("returns null when localStorage has null", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null)
      expect(getPostHogConsentState()).toBeNull()
    })

    it("returns null when localStorage has invalid value", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue("invalid")
      expect(getPostHogConsentState()).toBeNull()
    })

    it("returns null when localStorage has empty string", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue("")
      expect(getPostHogConsentState()).toBeNull()
    })

    it("returns null when localStorage throws (e.g., Safari private mode)", () => {
      vi.mocked(window.localStorage.getItem).mockImplementation(() => {
        throw new Error("localStorage is disabled")
      })
      expect(getPostHogConsentState()).toBeNull()
    })
  })

  describe("hasPostHogConsent", () => {
    it("returns true when consent state is 'granted'", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue("granted")
      expect(hasPostHogConsent()).toBe(true)
    })

    it("returns false when consent state is 'denied'", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue("denied")
      expect(hasPostHogConsent()).toBe(false)
    })

    it("returns false when consent state is null", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null)
      expect(hasPostHogConsent()).toBe(false)
    })

    it("returns false when localStorage throws", () => {
      vi.mocked(window.localStorage.getItem).mockImplementation(() => {
        throw new Error("localStorage is disabled")
      })
      expect(hasPostHogConsent()).toBe(false)
    })
  })

  describe("setPostHogConsentState", () => {
    it("returns false when window is undefined (SSR)", () => {
      vi.stubGlobal("window", undefined)
      expect(setPostHogConsentState("granted")).toBe(false)
    })

    it("stores 'granted' in localStorage and returns true", () => {
      const result = setPostHogConsentState("granted")

      expect(result).toBe(true)
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        POSTHOG_CONSENT_STORAGE_KEY,
        "granted"
      )
    })

    it("stores 'denied' in localStorage and returns true", () => {
      const result = setPostHogConsentState("denied")

      expect(result).toBe(true)
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        POSTHOG_CONSENT_STORAGE_KEY,
        "denied"
      )
    })

    it("dispatches consent changed event", () => {
      setPostHogConsentState("granted")

      expect(window.dispatchEvent).toHaveBeenCalledTimes(1)
      const dispatchedEvent = vi.mocked(window.dispatchEvent).mock.calls[0][0]
      expect(dispatchedEvent).toBeInstanceOf(Event)
      expect(dispatchedEvent.type).toBe(POSTHOG_CONSENT_EVENT)
    })

    it("returns false when localStorage.setItem throws (quota exceeded)", () => {
      vi.mocked(window.localStorage.setItem).mockImplementation(() => {
        throw new Error("QuotaExceededError")
      })

      const result = setPostHogConsentState("granted")

      expect(result).toBe(false)
      expect(window.dispatchEvent).not.toHaveBeenCalled()
    })

    it("returns false when localStorage.setItem throws (Safari private mode)", () => {
      vi.mocked(window.localStorage.setItem).mockImplementation(() => {
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError"
        )
      })

      const result = setPostHogConsentState("denied")

      expect(result).toBe(false)
      expect(window.dispatchEvent).not.toHaveBeenCalled()
    })
  })
})
