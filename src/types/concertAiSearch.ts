import { z } from "zod"

/**
 * Shapes for the AI-assisted "help me remember" concert backfill feature.
 * Shared between the client panel and the server routes — keep it free of
 * server-only imports.
 */

export const SEASON_VALUES = ["spring", "summer", "autumn", "winter"] as const
export type Season = (typeof SEASON_VALUES)[number]

/**
 * Structured search parameters extracted from a user's free-text concert memory.
 * Drives Groq `generateObject`. Every field is nullable (never omitted) so the
 * model must explicitly emit `null` for anything it cannot determine — this keeps
 * the output schema strict and prevents hallucinated fields.
 */
export const parsedConcertQuerySchema = z.object({
  artist: z
    .string()
    .nullable()
    .describe(
      "Primary headlining artist or band name, in its common canonical spelling (e.g. 'The Rolling Stones'). Null when the user only describes the act vaguely (gender, nationality, genre) without naming them."
    ),
  artistHints: z
    .string()
    .nullable()
    .describe(
      "Free-text description of the act when artist is null (e.g. 'German woman singer-songwriter'). Null when a proper artist name is given."
    ),
  city: z
    .string()
    .nullable()
    .describe("City name only, without country. Null if not stated."),
  venue: z
    .string()
    .nullable()
    .describe("Specific venue name if explicitly mentioned. Null otherwise."),
  festival: z
    .string()
    .nullable()
    .describe("Festival name if this was a festival. Null otherwise."),
  countryCode: z
    .string()
    .nullable()
    .describe(
      "ISO 3166-1 alpha-2 country code (e.g. GB, US, DE) only if the country is unambiguous from context. Null otherwise."
    ),
  yearStart: z
    .number()
    .int()
    .nullable()
    .describe(
      "Earliest plausible year. 'summer 99' -> 1999. 'early 2000s' -> 2000. A single explicit year sets this and yearEnd equal."
    ),
  yearEnd: z
    .number()
    .int()
    .nullable()
    .describe(
      "Latest plausible year of the range. Equal to yearStart for a single year. 'early 2000s' -> 2003."
    ),
  season: z
    .enum(SEASON_VALUES)
    .nullable()
    .describe("Northern-hemisphere season if stated. Null otherwise."),
  month: z
    .number()
    .int()
    .min(1)
    .max(12)
    .nullable()
    .describe(
      "Calendar month 1-12 if a specific month is named. Null otherwise."
    ),
})

export type ParsedConcertQuery = z.infer<typeof parsedConcertQuerySchema>

/**
 * A candidate show surfaced to the user, mapped from a Setlist.fm setlist.
 * This is the minimal DTO returned by the search endpoint (no raw Setlist.fm
 * passthrough, no prose echo).
 */
export interface CandidateShow {
  /** Setlist.fm setlist id — the only token the client sends back to add. */
  id: string
  /** ISO 8601 `YYYY-MM-DD`, converted from Setlist.fm `dd-MM-yyyy`. */
  date: string
  venue: string | null
  city: string | null
  country: string | null
  headliner: string
  /** Setlist.fm artist MBID, when present (kept for future band dedup). */
  artistMbid: string | null
  /** Best-effort city-centroid coords; null when Setlist.fm omits them. */
  lat: number | null
  lon: number | null
  /** Link so the user can verify the show on setlist.fm. */
  setlistUrl: string | null
  /** True when this show already exists in the user's list (pre-checked). */
  alreadyAdded: boolean
  /** Edit path for an already-added show (when known). */
  editPath: string | null
}

export interface ConcertAiSearchResponse {
  candidates: CandidateShow[]
  /** Echo of the parsed query, used by the client to compose a refine hint. */
  parsed: ParsedConcertQuery | null
  /** Non-null when there are zero candidates: a contextual "try adding X" hint. */
  hint: string | null
}
