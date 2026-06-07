import { describe, test, expect } from "vitest"
import {
  buildConcertParseSystemPrompt,
  extractJsonObject,
  parseConcertProseHeuristic,
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

describe("parseConcertProseHeuristic", () => {
  const now = new Date("2026-06-07T12:00:00.000Z")

  test("parses lowercase artist with city and this year", () => {
    const parsed = parseConcertProseHeuristic(
      "I saw sportfreunde stiller in Stuttgart this year.",
      now
    )
    expect(parsed).toEqual({
      artist: "Sportfreunde Stiller",
      city: "Stuttgart",
      venue: null,
      festival: null,
      countryCode: null,
      yearStart: 2026,
      yearEnd: 2026,
      season: null,
      month: null,
    })
  })

  test("parses artist with explicit year and south germany region", () => {
    const parsed = parseConcertProseHeuristic(
      "I saw Die Ärzte in 2003 in South germany.",
      now
    )
    expect(parsed?.artist).toBe("Die Ärzte")
    expect(parsed?.yearStart).toBe(2003)
    expect(parsed?.countryCode).toBe("DE")
    expect(parsed?.city).toBeNull()
  })

  test("parses venue and year", () => {
    const parsed = parseConcertProseHeuristic(
      "I saw The Rolling Stones at Wembley Arena in 2003.",
      now
    )
    expect(parsed?.artist).toBe("The Rolling Stones")
    expect(parsed?.venue).toBe("Wembley Arena")
    expect(parsed?.yearStart).toBe(2003)
  })
})
