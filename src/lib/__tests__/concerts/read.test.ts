import { beforeEach, describe, expect, test, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { getConcertById, getEffectiveBandsForForm } from "@/lib/concerts/read"

describe("read.ts dedicated coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("getConcertById returns transformed concert and handles optional user attendance", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "c1",
      date: new Date("2024-05-01T00:00:00.000Z"),
      latitude: 1,
      longitude: 2,
      normalizedCity: "Berlin",
      venue: "Venue",
      isFestival: false,
      festival: null,
      bands: [
        {
          bandId: "b1",
          isHeadliner: true,
          sortOrder: 0,
          band: { id: "b1", name: "Band", slug: "band", imageUrl: null, websiteUrl: null, lastfmUrl: null, genres: [], bio: null },
        },
      ],
      attendees: [{ id: "a1", userId: "u1", cost: 20, notes: null, supportingActIds: [] }],
      _count: { attendees: 1 },
    } as any)

    const result = await getConcertById("c1", "u1")
    expect(result?.id).toBe("c1")
    expect(result?.attendance?.userId).toBe("u1")
  })

  test("getEffectiveBandsForForm uses legacy fallback when attendance exists but parse returns null", async () => {
    const bands = [
      {
        bandId: "head",
        isHeadliner: true,
        sortOrder: 0,
        band: { id: "head", name: "Head", slug: "head" },
      },
      {
        bandId: "support-legacy",
        isHeadliner: false,
        sortOrder: 1,
        band: { id: "support-legacy", name: "Legacy", slug: "legacy" },
      },
    ] as any

    const result = await getEffectiveBandsForForm(
      { bands },
      { supportingActIds: [{ invalid: true }] } as any,
    )
    expect(result).toEqual([
      { bandId: "head", name: "Head", slug: "head", isHeadliner: true },
      { bandId: "support-legacy", name: "Legacy", slug: "legacy", isHeadliner: false },
    ])
  })

  test("getEffectiveBandsForForm maps parsed supporting acts through prisma.band.findMany", async () => {
    vi.mocked(prisma.band.findMany).mockResolvedValueOnce([
      { id: "support-1", name: "Support", slug: "support" },
    ] as any)

    const result = await getEffectiveBandsForForm(
      {
        bands: [
          {
            bandId: "head",
            isHeadliner: true,
            sortOrder: 0,
            band: { id: "head", name: "Head", slug: "head" },
          },
        ],
      } as any,
      { supportingActIds: [{ bandId: "support-1", sortOrder: 0 }] } as any,
    )

    expect(result).toEqual([
      { bandId: "head", name: "Head", slug: "head", isHeadliner: true },
      { bandId: "support-1", name: "Support", slug: "support", isHeadliner: false },
    ])
  })
})
