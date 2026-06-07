import { describe, test, expect } from "vitest"
import {
  buildConcertParseSystemPrompt,
  extractJsonObject,
} from "@/lib/concerts/aiParse"

describe("buildConcertParseSystemPrompt", () => {
  test("includes the current UTC year for relative date rules", () => {
    const prompt = buildConcertParseSystemPrompt(
      new Date("2026-06-07T12:00:00.000Z")
    )
    expect(prompt).toContain("current year 2026")
    expect(prompt).toContain('"this year" -> yearStart=yearEnd=2026')
    expect(prompt).toContain('"last year" -> 2025')
  })

  test("documents that regions are not cities", () => {
    expect(buildConcertParseSystemPrompt()).toMatch(/regions.*NOT cities/i)
    expect(buildConcertParseSystemPrompt()).toMatch(/South Germany -> DE/)
  })
})

describe("extractJsonObject", () => {
  test("parses bare JSON objects", () => {
    expect(extractJsonObject('{"artist":"Die Ärzte","city":null}')).toEqual({
      artist: "Die Ärzte",
      city: null,
    })
  })

  test("parses fenced JSON blocks", () => {
    const raw = 'Here you go:\n```json\n{"yearStart":2026}\n```'
    expect(extractJsonObject(raw)).toEqual({ yearStart: 2026 })
  })

  test("returns null for invalid JSON", () => {
    expect(extractJsonObject("not json")).toBeNull()
  })
})
