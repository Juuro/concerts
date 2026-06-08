import { describe, it, expect } from "vitest"
import {
  deriveAuthProviderLabel,
  deriveUserAccountStatus,
  getAccountStatusLabel,
  getAuthProviderLabel,
} from "../user-account-status"

describe("deriveUserAccountStatus", () => {
  it("returns active for a verified, non-banned user without pending reset", () => {
    expect(
      deriveUserAccountStatus({
        banned: false,
        emailVerified: true,
        hasPendingPasswordReset: false,
      })
    ).toBe("active")
  })

  it("returns unverified when email is not verified and no higher-priority state applies", () => {
    expect(
      deriveUserAccountStatus({
        banned: false,
        emailVerified: false,
        hasPendingPasswordReset: false,
      })
    ).toBe("unverified")
  })

  it("returns reset_pending when a password reset is pending and user is not banned", () => {
    expect(
      deriveUserAccountStatus({
        banned: false,
        emailVerified: true,
        hasPendingPasswordReset: true,
      })
    ).toBe("reset_pending")
  })

  it("returns banned when user is banned regardless of other flags", () => {
    expect(
      deriveUserAccountStatus({
        banned: true,
        emailVerified: false,
        hasPendingPasswordReset: true,
      })
    ).toBe("banned")
  })

  it("prioritizes reset_pending over unverified", () => {
    expect(
      deriveUserAccountStatus({
        banned: false,
        emailVerified: false,
        hasPendingPasswordReset: true,
      })
    ).toBe("reset_pending")
  })
})

describe("getAccountStatusLabel", () => {
  it.each([
    ["banned", "Banned"],
    ["reset_pending", "Reset pending"],
    ["unverified", "Unverified"],
    ["active", "Active"],
  ] as const)("maps %s to %s", (status, label) => {
    expect(getAccountStatusLabel(status)).toBe(label)
  })
})

describe("deriveAuthProviderLabel", () => {
  it("returns email for credential-only accounts", () => {
    expect(deriveAuthProviderLabel(["credential"])).toBe("email")
  })

  it("returns github for github-only accounts", () => {
    expect(deriveAuthProviderLabel(["github"])).toBe("github")
  })

  it("returns both when credential and github providers are present", () => {
    expect(deriveAuthProviderLabel(["credential", "github"])).toBe("both")
  })

  it("returns null when no recognized providers are present", () => {
    expect(deriveAuthProviderLabel([])).toBeNull()
    expect(deriveAuthProviderLabel(["google"])).toBeNull()
  })
})

describe("getAuthProviderLabel", () => {
  it.each([
    ["email", "Email"],
    ["github", "GitHub"],
    ["both", "Email + GitHub"],
  ] as const)("maps %s to %s", (label, display) => {
    expect(getAuthProviderLabel(label)).toBe(display)
  })
})
