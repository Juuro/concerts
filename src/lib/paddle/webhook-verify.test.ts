import { describe, expect, it } from "vitest"
import { verifyPaddleWebhookSignature } from "./webhook-verify"

describe("verifyPaddleWebhookSignature", () => {
  it("rejects missing signature", () => {
    const r = verifyPaddleWebhookSignature("{}", null, "secret")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("missing_signature")
  })

  it("rejects invalid format", () => {
    const r = verifyPaddleWebhookSignature("{}", "bad", "secret")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("invalid_signature_format")
  })

  it("rejects stale timestamp", () => {
    const oldTs = Math.floor(Date.now() / 1000) - 99999
    const r = verifyPaddleWebhookSignature("{}", `ts=${oldTs};h1=abc`, "secret")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("timestamp_outside_window")
  })
})
