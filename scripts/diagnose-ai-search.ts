/* Throwaway diagnostic for the AI concert search. Run:
 *   yarn tsx --env-file=.env scripts/diagnose-ai-search.ts
 */
import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { parsedConcertQuerySchema } from "../src/types/concertAiSearch"

const PROSE = "I saw The Rolling Stones in 2003 at Wembley Arena."

function mask(v?: string) {
  return v ? `set (${v.length} chars, starts ${v.slice(0, 4)}…)` : "MISSING"
}

async function checkSetlistfm() {
  console.log("\n========== SETLIST.FM ==========")
  const key = process.env.SETLISTFM_API_KEY
  console.log("SETLISTFM_API_KEY:", mask(key))
  if (!key) return

  const base = "https://api.setlist.fm/rest/1.0"
  const headers = {
    Accept: "application/json",
    "x-api-key": key,
    "User-Agent": "Concertivity/1.0 (https://github.com/Juuro/Concertivity)",
  }

  const calls: [string, string][] = [
    [
      "search/artists",
      `${base}/search/artists?artistName=${encodeURIComponent("The Rolling Stones")}&sort=relevance`,
    ],
    [
      "search/setlists by artistName+year",
      `${base}/search/setlists?artistName=${encodeURIComponent("The Rolling Stones")}&year=2003`,
    ],
    [
      "search/setlists by venueName+year",
      `${base}/search/setlists?artistName=${encodeURIComponent("The Rolling Stones")}&venueName=${encodeURIComponent("Wembley Arena")}&year=2003`,
    ],
  ]

  for (const [label, url] of calls) {
    try {
      const res = await fetch(url, { headers })
      const text = await res.text()
      console.log(`\n[${label}] ${url}`)
      console.log("  status:", res.status, res.statusText)
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = text.slice(0, 400)
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        "total" in (parsed as Record<string, unknown>)
      ) {
        const p = parsed as Record<string, unknown>
        console.log("  total:", p.total, " itemsPerPage:", p.itemsPerPage)
        const arr = (p.setlist ?? p.artist) as unknown[] | undefined
        if (Array.isArray(arr) && arr[0]) {
          console.log("  first item keys:", Object.keys(arr[0] as object))
          console.log("  first item:", JSON.stringify(arr[0]).slice(0, 600))
        }
      } else {
        console.log(
          "  body:",
          typeof parsed === "string"
            ? parsed
            : JSON.stringify(parsed).slice(0, 400)
        )
      }
    } catch (err) {
      console.log(`  FETCH ERROR for ${label}:`, (err as Error).message)
    }
  }
}

async function checkGroq() {
  console.log("\n========== GROQ ==========")
  const key = process.env.GROQ_API_KEY
  console.log("GROQ_API_KEY:", mask(key))
  if (!key) return

  const models = ["openai/gpt-oss-20b", "llama-3.3-70b-versatile"]
  const groq = createGroq({ apiKey: key })

  for (const model of models) {
    console.log(`\n--- model: ${model} ---`)
    try {
      const { object, usage } = await generateObject({
        model: groq(model),
        schema: parsedConcertQuerySchema,
        schemaName: "ConcertSearchQuery",
        schemaDescription:
          "Structured search parameters extracted from a concert memory.",
        system:
          "Extract concert search parameters. Return null for anything not stated.",
        prompt: `<user_memory>\n${PROSE}\n</user_memory>`,
        temperature: 0,
        maxOutputTokens: 300,
        maxRetries: 0,
      })
      console.log("  OK object:", JSON.stringify(object))
      console.log("  usage:", JSON.stringify(usage))
    } catch (err) {
      const e = err as Record<string, unknown>
      console.log("  THREW:", (err as Error).name, "-", (err as Error).message)
      for (const field of [
        "statusCode",
        "url",
        "responseBody",
        "text",
        "cause",
        "data",
      ]) {
        if (e[field] !== undefined) {
          const v = e[field]
          console.log(
            `  .${field}:`,
            typeof v === "string"
              ? v.slice(0, 800)
              : JSON.stringify(v).slice(0, 800)
          )
        }
      }
    }
  }
}

async function main() {
  await checkSetlistfm()
  await checkGroq()
}

main().catch((e) => {
  console.error("fatal:", e)
  process.exit(1)
})
