import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { generateObject, generateText } from "ai"
import { createGroq } from "@ai-sdk/groq"
import {
  buildConcertParseSystemPrompt,
  extractJsonObject,
  MAX_PROSE_LENGTH,
  parseConcertProse,
  parseConcertProseHeuristic,
} from "@/lib/concerts/aiParse"
import { FEATURE_FLAGS } from "@/utils/featureFlags"

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}))

vi.mock("@ai-sdk/groq", () => ({
  createGroq: vi.fn(() => (modelId: string) => modelId),
}))

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

  test("parses decade phrase with trailing city", () => {
    const parsed = parseConcertProseHeuristic(
      "I saw Nirvana in the beginning of the 90ies in PAris.",
      now
    )
    expect(parsed).toEqual({
      artist: "Nirvana",
      city: "Paris",
      venue: null,
      festival: null,
      countryCode: null,
      yearStart: 1990,
      yearEnd: 1993,
      season: null,
      month: null,
    })
  })

  test("parses artist, city, and last year", () => {
    const parsed = parseConcertProseHeuristic(
      "I saw Radiohead in Berlin last year.",
      now
    )
    expect(parsed).toEqual({
      artist: "Radiohead",
      city: "Berlin",
      venue: null,
      festival: null,
      countryCode: null,
      yearStart: 2025,
      yearEnd: 2025,
      season: null,
      month: null,
    })
  })

  test("parses late-decade ranges and region hints", () => {
    const parsed = parseConcertProseHeuristic(
      "I saw Pearl Jam in the late 90s in Bavaria.",
      now
    )
    expect(parsed?.artist).toBe("Pearl Jam")
    expect(parsed?.yearStart).toBe(1996)
    expect(parsed?.yearEnd).toBe(1999)
    expect(parsed?.countryCode).toBe("DE")
  })

  test("returns null for empty prose or when no anchor is found", () => {
    expect(parseConcertProseHeuristic("", now)).toBeNull()
    expect(parseConcertProseHeuristic("just some random words", now)).toBeNull()
  })
})

describe("parseConcertProse", () => {
  const validParsed = {
    artist: "The Rolling Stones",
    city: "London",
    venue: null,
    festival: null,
    countryCode: null,
    yearStart: 1999,
    yearEnd: 1999,
    season: null,
    month: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv(FEATURE_FLAGS.ENABLE_CONCERT_AI_SEARCH, "true")
    vi.stubEnv("GROQ_API_KEY", "test-groq-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test("returns null when the feature flag is disabled", async () => {
    vi.stubEnv(FEATURE_FLAGS.ENABLE_CONCERT_AI_SEARCH, "false")

    await expect(
      parseConcertProse("I saw Radiohead in Berlin")
    ).resolves.toBeNull()
    expect(generateObject).not.toHaveBeenCalled()
  })

  test("returns null for empty or overlong prose", async () => {
    await expect(parseConcertProse("   ")).resolves.toBeNull()
    await expect(
      parseConcertProse("x".repeat(MAX_PROSE_LENGTH + 1))
    ).resolves.toBeNull()
  })

  test("returns null when GROQ_API_KEY is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      parseConcertProse("I saw Radiohead in Berlin")
    ).resolves.toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  test("returns structured parse results from the primary model", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: validParsed,
    } as never)

    await expect(
      parseConcertProse("Rolling Stones in London 1999")
    ).resolves.toEqual(validParsed)
    expect(createGroq).toHaveBeenCalledWith({ apiKey: "test-groq-key" })
    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  test("falls back to text parsing when structured output fails", async () => {
    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error("structured failed"))
      .mockRejectedValueOnce(new Error("structured failed again"))
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify(validParsed),
    } as never)

    await expect(
      parseConcertProse("Rolling Stones in London 1999")
    ).resolves.toEqual(validParsed)
    expect(generateText).toHaveBeenCalledTimes(1)
  })

  test("uses the heuristic parser when every Groq strategy fails", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("structured failed"))
    vi.mocked(generateText).mockResolvedValue({ text: "not json" } as never)

    await expect(
      parseConcertProse("I saw sportfreunde stiller in Stuttgart this year.")
    ).resolves.toEqual({
      artist: "Sportfreunde Stiller",
      city: "Stuttgart",
      venue: null,
      festival: null,
      countryCode: null,
      yearStart: new Date().getUTCFullYear(),
      yearEnd: new Date().getUTCFullYear(),
      season: null,
      month: null,
    })
  })

  test("returns null when Groq and heuristics both fail", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("structured failed"))
    vi.mocked(generateText).mockResolvedValue({ text: "not json" } as never)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(parseConcertProse("nothing useful here")).resolves.toBeNull()
    expect(error).toHaveBeenCalledWith("Groq concert-prose parse failed")
    error.mockRestore()
  })
})
