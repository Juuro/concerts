import { describe, it, expect } from "vitest"
import {
  feedbackGithubCreateSchema,
  feedbackListQuerySchema,
  feedbackTriagePatchSchema,
} from "./triage-schema"

describe("feedbackListQuerySchema", () => {
  it("applies defaults for empty object", () => {
    const r = feedbackListQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.queue).toBe("active")
      expect(r.data.limit).toBe(20)
      expect(r.data.offset).toBe(0)
    }
  })

  it("accepts explicit queue and pagination", () => {
    const r = feedbackListQuerySchema.safeParse({
      queue: "all",
      limit: 50,
      offset: 10,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.queue).toBe("all")
      expect(r.data.limit).toBe(50)
      expect(r.data.offset).toBe(10)
    }
  })

  it("rejects limit below 1", () => {
    const r = feedbackListQuerySchema.safeParse({ limit: 0 })
    expect(r.success).toBe(false)
  })

  it("rejects limit above 100", () => {
    const r = feedbackListQuerySchema.safeParse({ limit: 101 })
    expect(r.success).toBe(false)
  })

  it("rejects negative offset", () => {
    const r = feedbackListQuerySchema.safeParse({ offset: -1 })
    expect(r.success).toBe(false)
  })

  it("rejects invalid queue mode", () => {
    const r = feedbackListQuerySchema.safeParse({ queue: "pending" })
    expect(r.success).toBe(false)
  })
})

describe("feedbackTriagePatchSchema", () => {
  it("accepts triageStatus only", () => {
    const r = feedbackTriagePatchSchema.safeParse({ triageStatus: "TRIAGED" })
    expect(r.success).toBe(true)
  })

  it("accepts internalNotes null", () => {
    const r = feedbackTriagePatchSchema.safeParse({ internalNotes: null })
    expect(r.success).toBe(true)
  })

  it("accepts empty tags array", () => {
    const r = feedbackTriagePatchSchema.safeParse({ tags: [] })
    expect(r.success).toBe(true)
  })

  it("rejects empty object", () => {
    const r = feedbackTriagePatchSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})

describe("feedbackGithubCreateSchema", () => {
  it("accepts valid create payload", () => {
    const r = feedbackGithubCreateSchema.safeParse({
      title: "Broken map",
      body: "The map does not load on Safari.",
      labels: ["bug"],
    })
    expect(r.success).toBe(true)
  })

  it("rejects title shorter than 5 characters", () => {
    const r = feedbackGithubCreateSchema.safeParse({
      title: "x",
      body: "y".repeat(10),
    })
    expect(r.success).toBe(false)
  })

  it("rejects body shorter than 10 characters", () => {
    const r = feedbackGithubCreateSchema.safeParse({
      title: "Valid title here",
      body: "short",
    })
    expect(r.success).toBe(false)
  })
})
