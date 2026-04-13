import { describe, it, expect } from "vitest"
import { feedbackBodySchema } from "./schema"

describe("feedbackBodySchema", () => {
  it("accepts valid payload", () => {
    const r = feedbackBodySchema.safeParse({
      category: "BUG",
      message: "Something broke on the map view.",
      pagePath: "/map",
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.category).toBe("BUG")
      expect(r.data.pagePath).toBe("/map")
    }
  })

  it("rejects message shorter than 10 characters", () => {
    const r = feedbackBodySchema.safeParse({
      category: "GENERAL",
      message: "short",
    })
    expect(r.success).toBe(false)
  })

  it("rejects invalid category", () => {
    const r = feedbackBodySchema.safeParse({
      category: "NPS",
      message: "x".repeat(10),
    })
    expect(r.success).toBe(false)
  })

  it("maps empty pagePath to undefined", () => {
    const r = feedbackBodySchema.safeParse({
      category: "FEATURE",
      message: "Please add dark mode support!",
      pagePath: "   ",
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.pagePath).toBeUndefined()
    }
  })
})
