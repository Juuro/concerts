import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import type { ParsedConcertQuery } from "@/types/concertAiSearch"
import type { SetlistfmSetlist } from "@/types/setlistfm"

vi.mock("@/lib/concerts/aiParse", () => ({
  parseConcertProse: vi.fn(),
  MAX_PROSE_LENGTH: 500,
}))
vi.mock("@/utils/setlistfm", () => ({
  searchSetlists: vi.fn(),
  searchArtists: vi.fn(),
  getSetlistById: vi.fn(),
}))
vi.mock("@/lib/bands", () => ({
  getOrCreateBand: vi.fn(),
  enrichBandData: vi.fn(),
}))
vi.mock("@/utils/photon", () => ({
  searchVenues: vi.fn(),
}))

import { parseConcertProse } from "@/lib/concerts/aiParse"
import {
  searchSetlists,
  searchArtists,
  getSetlistById,
} from "@/utils/setlistfm"
import { getOrCreateBand, enrichBandData } from "@/lib/bands"
import { searchVenues } from "@/utils/photon"
import {
  parseEventDate,
  searchConcertCandidates,
  buildCreateInputFromSetlist,
} from "@/lib/concerts/aiSearch"

function pq(partial: Partial<ParsedConcertQuery>): ParsedConcertQuery {
  return {
    artist: null,
    city: null,
    venue: null,
    festival: null,
    countryCode: null,
    yearStart: null,
    yearEnd: null,
    season: null,
    month: null,
    ...partial,
  }
}

function setlist(
  over: Partial<SetlistfmSetlist> & { id: string; eventDate: string }
): SetlistfmSetlist {
  return {
    artist: { name: "The Rolling Stones", mbid: "mbid-1" },
    venue: {
      name: "Wembley Stadium",
      city: {
        name: "London",
        coords: { lat: 51.556, long: -0.2796 },
        country: { code: "GB", name: "United Kingdom" },
      },
    },
    url: `https://www.setlist.fm/setlist/${over.id}.html`,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.userConcert.findMany).mockResolvedValue([] as never)
  vi.mocked(searchArtists).mockResolvedValue([])
  vi.mocked(searchSetlists).mockResolvedValue([])
})

describe("parseEventDate", () => {
  test("parses dd-MM-yyyy to UTC midnight + ISO (no timezone drift)", () => {
    const result = parseEventDate("11-07-1999")
    expect(result).not.toBeNull()
    expect(result!.iso).toBe("1999-07-11")
    expect(result!.date.toISOString()).toBe("1999-07-11T00:00:00.000Z")
    expect(result!.month).toBe(7)
    expect(result!.year).toBe(1999)
  })

  test("rejects malformed input", () => {
    expect(parseEventDate("1999-07-11")).toBeNull()
    expect(parseEventDate("garbage")).toBeNull()
    expect(parseEventDate("")).toBeNull()
  })

  test("rejects impossible calendar dates", () => {
    expect(parseEventDate("31-02-2020")).toBeNull()
    expect(parseEventDate("00-01-2020")).toBeNull()
    expect(parseEventDate("01-13-2020")).toBeNull()
  })

  test("rejects pre-1900 and far-future years", () => {
    expect(parseEventDate("01-01-1899")).toBeNull()
    const farFuture = String(new Date().getUTCFullYear() + 5)
    expect(parseEventDate(`01-01-${farFuture}`)).toBeNull()
  })
})

describe("searchConcertCandidates", () => {
  test("returns hint and no candidates when parse fails", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(null)
    const result = await searchConcertCandidates("???", "user-1")
    expect(result.candidates).toEqual([])
    expect(result.parsed).toBeNull()
    expect(result.hint).toBeTruthy()
    expect(searchSetlists).not.toHaveBeenCalled()
  })

  test("returns 'name the band' hint when no anchor fields are present", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(pq({ yearStart: 1999 }))
    const result = await searchConcertCandidates("something in 1999", "user-1")
    expect(result.candidates).toEqual([])
    expect(result.hint).toMatch(/band or artist/i)
    expect(searchSetlists).not.toHaveBeenCalled()
  })

  test("pins the artist by MBID and maps candidates", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(
      pq({
        artist: "The Rolling Stones",
        city: "London",
        yearStart: 1999,
        yearEnd: 1999,
      })
    )
    vi.mocked(searchArtists).mockResolvedValue([
      { name: "The Rolling Stones", mbid: "mbid-stones" },
    ])
    vi.mocked(searchSetlists).mockResolvedValue([
      setlist({ id: "aaa1", eventDate: "11-07-1999" }),
      setlist({ id: "bbb2", eventDate: "12-07-1999" }),
    ])

    const result = await searchConcertCandidates(
      "Stones, London, '99",
      "user-1"
    )

    // Single year => exactly one search call, pinned by artistMbid.
    expect(searchSetlists).toHaveBeenCalledTimes(1)
    expect(searchSetlists).toHaveBeenCalledWith(
      expect.objectContaining({
        artistMbid: "mbid-stones",
        cityName: "London",
        year: 1999,
      })
    )
    expect(result.candidates).toHaveLength(2)
    const first = result.candidates[0]
    expect(first.date).toBe("1999-07-12") // newest first
    expect(first.venue).toBe("Wembley Stadium")
    expect(first.city).toBe("London")
    expect(first.country).toBe("United Kingdom")
    expect(first.lat).toBe(51.556)
    expect(first.lon).toBe(-0.2796) // mapped from coords.long
    expect(first.headliner).toBe("The Rolling Stones")
    expect(result.hint).toBeNull()
  })

  test("caps a wide year range to one query and filters client-side", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(
      pq({ artist: "Metallica", yearStart: 1990, yearEnd: 2005 })
    )
    vi.mocked(searchSetlists).mockResolvedValue([
      setlist({
        id: "in1",
        eventDate: "01-06-1995",
        artist: { name: "Metallica" },
      }),
      setlist({
        id: "out1",
        eventDate: "01-06-2010",
        artist: { name: "Metallica" },
      }),
    ])

    const result = await searchConcertCandidates(
      "Metallica in the 90s/00s",
      "user-1"
    )

    // Span > 3 years => one un-yeared query (no `year` param).
    expect(searchSetlists).toHaveBeenCalledTimes(1)
    expect(searchSetlists).toHaveBeenCalledWith(
      expect.not.objectContaining({ year: expect.anything() })
    )
    expect(result.candidates.map((c) => c.id)).toEqual(["in1"])
  })

  test("applies a season filter client-side", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(
      pq({
        artist: "Radiohead",
        yearStart: 2012,
        yearEnd: 2012,
        season: "summer",
      })
    )
    vi.mocked(searchSetlists).mockResolvedValue([
      setlist({
        id: "jul",
        eventDate: "10-07-2012",
        artist: { name: "Radiohead" },
      }),
      setlist({
        id: "jan",
        eventDate: "10-01-2012",
        artist: { name: "Radiohead" },
      }),
    ])

    const result = await searchConcertCandidates(
      "Radiohead summer 2012",
      "user-1"
    )
    expect(result.candidates.map((c) => c.id)).toEqual(["jul"])
  })

  test("retries venue-only when a city+venue search returns nothing", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(
      pq({
        artist: "The Rolling Stones",
        city: "Metro London",
        venue: "Wembley Arena",
        yearStart: 2003,
        yearEnd: 2003,
      })
    )
    vi.mocked(searchArtists).mockResolvedValue([
      { name: "The Rolling Stones", mbid: "mbid-stones" },
    ])
    vi.mocked(searchSetlists)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        setlist({ id: "wembley1", eventDate: "15-09-2003" }),
      ])

    const result = await searchConcertCandidates(
      "Stones at Wembley Arena 2003",
      "user-1"
    )

    expect(searchSetlists).toHaveBeenCalledTimes(2)
    expect(searchSetlists).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        artistMbid: "mbid-stones",
        cityName: "Metro London",
        venueName: "Wembley Arena",
        year: 2003,
      })
    )
    expect(searchSetlists).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        artistMbid: "mbid-stones",
        venueName: "Wembley Arena",
        year: 2003,
      })
    )
    expect(searchSetlists).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({ cityName: expect.anything() })
    )
    expect(result.candidates).toHaveLength(1)
    expect(result.hint).toBeNull()
  })

  test("searches by country and year when only a region is given (no city)", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(
      pq({
        artist: "Die Ärzte",
        countryCode: "DE",
        yearStart: 2003,
        yearEnd: 2003,
      })
    )
    vi.mocked(searchArtists).mockResolvedValue([
      { name: "Die Ärzte", mbid: "mbid-arzte" },
    ])
    vi.mocked(searchSetlists).mockResolvedValue([
      setlist({
        id: "stuttgart03",
        eventDate: "21-12-2003",
        artist: { name: "Die Ärzte", mbid: "mbid-arzte" },
        venue: {
          name: "Hanns-Martin-Schleyer-Halle",
          city: {
            name: "Stuttgart",
            coords: { lat: 48.79, long: 9.18 },
            country: { code: "DE", name: "Germany" },
          },
        },
      }),
    ])

    const result = await searchConcertCandidates(
      "Die Ärzte in 2003 in South germany",
      "user-1"
    )

    expect(searchSetlists).toHaveBeenCalledWith(
      expect.objectContaining({
        artistMbid: "mbid-arzte",
        countryCode: "DE",
        year: 2003,
      })
    )
    expect(searchSetlists).toHaveBeenCalledWith(
      expect.not.objectContaining({ cityName: expect.anything() })
    )
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].city).toBe("Stuttgart")
  })

  test("finds Nirvana in Paris for early-90s decade range via year filter", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(
      pq({
        artist: "Nirvana",
        city: "Paris",
        yearStart: 1990,
        yearEnd: 1993,
      })
    )
    vi.mocked(searchArtists).mockResolvedValue([
      { name: "Nirvana", mbid: "mbid-nirvana" },
    ])
    vi.mocked(searchSetlists).mockResolvedValue([
      setlist({
        id: "paris92",
        eventDate: "24-06-1992",
        artist: { name: "Nirvana", mbid: "mbid-nirvana" },
        venue: {
          name: "Le Zénith",
          city: {
            name: "Paris",
            coords: { lat: 48.89, long: 2.39 },
            country: { code: "FR", name: "France" },
          },
        },
      }),
      setlist({
        id: "paris94",
        eventDate: "14-02-1994",
        artist: { name: "Nirvana", mbid: "mbid-nirvana" },
        venue: {
          name: "Palais Omnisports",
          city: { name: "Paris", country: { code: "FR", name: "France" } },
        },
      }),
    ])

    const result = await searchConcertCandidates(
      "Nirvana beginning of the 90ies Paris",
      "user-1"
    )

    expect(searchSetlists).toHaveBeenCalledWith(
      expect.objectContaining({
        artistMbid: "mbid-nirvana",
        cityName: "Paris",
      })
    )
    expect(searchSetlists).toHaveBeenCalledWith(
      expect.not.objectContaining({ year: expect.anything() })
    )
    expect(result.candidates.map((c) => c.id)).toEqual(["paris92"])
  })

  test("marks candidates already in the user's list", async () => {
    vi.mocked(parseConcertProse).mockResolvedValue(
      pq({ artist: "The Rolling Stones", yearStart: 1999, yearEnd: 1999 })
    )
    vi.mocked(searchSetlists).mockResolvedValue([
      setlist({ id: "aaa1", eventDate: "11-07-1999" }),
    ])
    vi.mocked(prisma.userConcert.findMany).mockResolvedValue([
      {
        concert: {
          id: "concert-xyz",
          date: new Date("1999-07-11T00:00:00.000Z"),
          bands: [{ band: { slug: "the-rolling-stones" } }],
        },
      },
    ] as never)

    const result = await searchConcertCandidates("Stones 1999", "user-1")
    expect(result.candidates[0].alreadyAdded).toBe(true)
    expect(result.candidates[0].editPath).toBe("/concerts/edit/concert-xyz")
  })
})

describe("buildCreateInputFromSetlist", () => {
  beforeEach(() => {
    vi.mocked(getOrCreateBand).mockResolvedValue({
      id: "band-1",
      name: "The Rolling Stones",
      slug: "the-rolling-stones",
      url: "/band/the-rolling-stones/",
      imageEnrichedAt: new Date(),
    } as never)
    vi.mocked(enrichBandData).mockResolvedValue(undefined)
  })

  test("returns NOT_FOUND when the setlist can't be fetched", async () => {
    vi.mocked(getSetlistById).mockResolvedValue(null)
    const result = await buildCreateInputFromSetlist("abc123", "user-1")
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" })
  })

  test("returns INVALID_DATE for an unparseable event date", async () => {
    vi.mocked(getSetlistById).mockResolvedValue(
      setlist({ id: "abc123", eventDate: "99-99-9999" })
    )
    const result = await buildCreateInputFromSetlist("abc123", "user-1")
    expect(result).toEqual({ ok: false, code: "INVALID_DATE" })
  })

  test("prefers venue-precise geocoded coords over the city centroid", async () => {
    vi.mocked(getSetlistById).mockResolvedValue(
      setlist({ id: "abc123", eventDate: "11-07-1999" })
    )
    vi.mocked(searchVenues).mockResolvedValue([
      {
        name: "Wembley Stadium",
        displayName: "Wembley, London",
        lat: 51.556,
        lon: -0.2796,
      },
    ] as never)

    const result = await buildCreateInputFromSetlist("abc123", "user-1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.latitude).toBe(51.556)
    expect(result.input.longitude).toBe(-0.2796)
    expect(result.input.date.toISOString()).toBe("1999-07-11T00:00:00.000Z")
    expect(result.input.venue).toBe("Wembley Stadium")
    expect(result.input.isFestival).toBe(false)
    expect(result.input.bandIds).toEqual([
      { bandId: "band-1", isHeadliner: true },
    ])
    expect(getOrCreateBand).toHaveBeenCalledWith("The Rolling Stones", "user-1")
  })

  test("falls back to the city centroid when geocoding finds nothing", async () => {
    vi.mocked(getSetlistById).mockResolvedValue(
      setlist({ id: "abc123", eventDate: "11-07-1999" })
    )
    vi.mocked(searchVenues).mockResolvedValue([])

    const result = await buildCreateInputFromSetlist("abc123", "user-1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.latitude).toBe(51.556)
    expect(result.input.longitude).toBe(-0.2796)
  })

  test("returns MISSING_COORDINATES when neither geocoding nor centroid resolve", async () => {
    vi.mocked(getSetlistById).mockResolvedValue(
      setlist({
        id: "abc123",
        eventDate: "11-07-1999",
        venue: { name: "Tiny Club", city: { name: "Nowhere" } },
      })
    )
    vi.mocked(searchVenues).mockResolvedValue([])

    const result = await buildCreateInputFromSetlist("abc123", "user-1")
    expect(result).toEqual({ ok: false, code: "MISSING_COORDINATES" })
  })
})
