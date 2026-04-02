import { describe, expect, test, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { parseSupportingActIds, transformConcert, transformConcertsBatch } from "@/lib/concerts/transform"

describe("transform.ts dedicated coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("parseSupportingActIds returns null for invalid arrays and sorted output for valid items", () => {
    expect(parseSupportingActIds(null)).toBeNull()
    expect(parseSupportingActIds("x")).toBeNull()
    expect(parseSupportingActIds([{ nope: 1 }])).toBeNull()

    const parsed = parseSupportingActIds([
      { bandId: "b2", sortOrder: 2 },
      { bandId: "b1", sortOrder: 1 },
    ])
    expect(parsed).toEqual([
      { bandId: "b1", sortOrder: 1 },
      { bandId: "b2", sortOrder: 2 },
    ])
  })

  test("transformConcert uses coordinate fallback city and maps supporting acts from prefetched bands", async () => {
    vi.mocked(prisma.band.findMany).mockResolvedValueOnce([
      {
        id: "support-1",
        name: "Support One",
        slug: "support-one",
        imageUrl: null,
        imageEnrichedAt: null,
        lastfmUrl: null,
        websiteUrl: null,
        genres: [],
        bio: null,
      },
    ] as any)

    const concert: any = {
      id: "c1",
      date: new Date("2024-01-01T00:00:00.000Z"),
      latitude: 52.12345,
      longitude: 13.98765,
      normalizedCity: null,
      venue: "Venue",
      isFestival: false,
      festival: null,
      bands: [
        {
          bandId: "headliner-1",
          isHeadliner: true,
          sortOrder: 2,
          band: { id: "headliner-1", name: "Headliner", slug: "headliner", imageUrl: null, websiteUrl: null, lastfmUrl: null, genres: [], bio: null },
        },
      ],
      _count: { attendees: 1 },
    }
    const attendance: any = {
      id: "att-1",
      userId: "u1",
      cost: 12,
      notes: null,
      supportingActIds: [{ bandId: "support-1", sortOrder: 0 }],
    }

    const transformed = await transformConcert(concert, attendance)
    expect(transformed.fields.geocoderAddressFields._is_coordinates).toBe(true)
    expect(transformed.bands.map((b) => b.slug)).toEqual(["headliner", "support-one"])
  })

  test("transformConcertsBatch keeps empty prefetch map path when no supporting acts", async () => {
    const concert: any = {
      id: "c2",
      date: new Date("2024-01-01T00:00:00.000Z"),
      latitude: 1,
      longitude: 2,
      normalizedCity: "Berlin",
      venue: "Venue",
      isFestival: false,
      festival: null,
      bands: [
        {
          bandId: "h1",
          isHeadliner: true,
          sortOrder: 1,
          band: { id: "h1", name: "H", slug: "h", imageUrl: null, websiteUrl: null, lastfmUrl: null, genres: [], bio: null },
        },
      ],
      _count: { attendees: 1 },
    }
    const result = await transformConcertsBatch([{ concert } as any])
    expect(result).toHaveLength(1)
    expect(prisma.band.findMany).not.toHaveBeenCalled()
  })
})
