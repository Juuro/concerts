/**
 * Phase 1: Query Functions tests extracted from `src/lib/concerts.test.ts`.
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  getAllConcerts,
  getConcertsByBand,
  getConcertsByYear,
  getConcertsByCity,
  getAllYears,
  getAllCities,
} from "@/lib/concerts/read"

// Mock external utilities
vi.mock("@/utils/data", () => ({
  getGeocodingData: vi.fn().mockResolvedValue({
    _normalized_city: "Test City",
    _is_coordinates: false,
  }),
}))

describe("Query Functions", () => {
  const mockBand = {
    id: "band-test-1",
    name: "Test Band",
    slug: "test-band",
    imageUrl: null,
    imageEnrichedAt: null,
    lastfmUrl: null,
    websiteUrl: null,
    genres: [],
    bio: null,
    createdById: "user-test-1",
    updatedById: null,
  }

  const mockConcertWithRelations = {
    id: "concert-q-1",
    date: new Date("2024-06-15"),
    latitude: 52.52,
    longitude: 13.405,
    venue: "Test Arena",
    normalizedCity: "Berlin",
    isFestival: false,
    festivalId: null,
    createdById: "user-test-1",
    updatedById: null,
    bands: [
      {
        concertId: "concert-q-1",
        bandId: "band-test-1",
        isHeadliner: true,
        sortOrder: 0,
        band: mockBand,
      },
    ],
    festival: null,
    _count: { attendees: 1 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getAllConcerts", () => {
    test("test_getAllConcerts_returns_transformed_concerts", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getAllConcerts()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("concert-q-1")
      expect(result[0].venue).toBe("Test Arena")
      expect(result[0].bands).toHaveLength(1)
      expect(result[0].bands[0].name).toBe("Test Band")
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: "desc" },
        }),
      )
    })

    test("test_getAllConcerts_empty_database_returns_empty_array", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getAllConcerts()

      expect(result).toEqual([])
    })
  })

  describe("getConcertsByBand", () => {
    test("test_getConcertsByBand_filters_by_slug", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByBand("test-band")

      expect(result).toHaveLength(1)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            bands: { some: { band: { slug: "test-band" } } },
          },
        }),
      )
    })

    test("test_getConcertsByBand_nonexistent_slug_returns_empty", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByBand("nonexistent-slug")

      expect(result).toEqual([])
    })
  })

  describe("getConcertsByYear", () => {
    test("test_getConcertsByYear_number_input_uses_date_range", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByYear(2024)

      expect(result).toHaveLength(1)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: new Date(2024, 0, 1),
              lte: new Date(2024, 11, 31, 23, 59, 59, 999),
            },
          },
        }),
      )
    })

    test("test_getConcertsByYear_string_input_converts_to_number", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByYear("2024")

      expect(result).toHaveLength(1)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: new Date(2024, 0, 1),
              lte: new Date(2024, 11, 31, 23, 59, 59, 999),
            },
          },
        }),
      )
    })
  })

  describe("getConcertsByCity", () => {
    test("test_getConcertsByCity_filters_by_normalizedCity", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByCity("Berlin")

      expect(result).toHaveLength(1)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { normalizedCity: "Berlin" },
        }),
      )
    })

    test("test_getConcertsByCity_no_match_returns_empty", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByCity("Nonexistent City")

      expect(result).toEqual([])
    })
  })

  describe("getAllYears", () => {
    test("test_getAllYears_returns_sorted_unique_years", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([
        { date: new Date("2023-06-15") },
        { date: new Date("2023-08-20") },
        { date: new Date("2022-07-10") },
        { date: new Date("2021-05-01") },
      ] as any)

      const result = await getAllYears()

      expect(result).toEqual(["2021", "2022", "2023"])
      // Verify past-only filter (lte: now)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { date: { lte: expect.any(Date) } },
          select: { date: true },
        }),
      )
    })

    test("test_getAllYears_empty_returns_empty", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])

      const result = await getAllYears()

      expect(result).toEqual([])
    })
  })

  describe("getAllCities", () => {
    test("test_getAllCities_returns_sorted_distinct_cities", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([
        { normalizedCity: "Munich" },
        { normalizedCity: "Berlin" },
        { normalizedCity: "Hamburg" },
      ] as any)

      const result = await getAllCities()

      expect(result).toEqual(["Berlin", "Hamburg", "Munich"])
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { normalizedCity: { not: null } },
          distinct: ["normalizedCity"],
        }),
      )
    })

    test("test_getAllCities_empty_returns_empty", async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])

      const result = await getAllCities()

      expect(result).toEqual([])
    })
  })
})

describe("getEffectiveBandsForForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_getEffectiveBandsForForm_null_attendance_returns_headliner_only", async () => {
    const concert = {
      bands: [
        {
          concertId: "c-1",
          bandId: "band-headliner",
          isHeadliner: true,
          sortOrder: 0,
          band: { id: "band-headliner", name: "Headliner Band", slug: "headliner-band" },
        },
      ],
    }

    const { getEffectiveBandsForForm } = await import("@/lib/concerts/read")
    const result = await getEffectiveBandsForForm(concert as any, null)
    expect(result).toHaveLength(1)
    expect(result[0].bandId).toBe("band-headliner")
    expect(prisma.band.findMany).not.toHaveBeenCalled()
  })

  test("test_getEffectiveBandsForForm_with_supporting_acts_returns_all", async () => {
    const concert = {
      bands: [
        {
          concertId: "c-2",
          bandId: "band-headliner-2",
          isHeadliner: true,
          sortOrder: 0,
          band: { id: "band-headliner-2", name: "Main Act", slug: "main-act" },
        },
      ],
    }
    const attendance = {
      supportingActIds: [
        { bandId: "band-support-1", sortOrder: 0 },
        { bandId: "band-support-2", sortOrder: 1 },
      ],
    }
    vi.mocked(prisma.band.findMany).mockResolvedValue([
      { id: "band-support-1", name: "Support A", slug: "support-a" },
      { id: "band-support-2", name: "Support B", slug: "support-b" },
    ] as any)
    const { getEffectiveBandsForForm } = await import("@/lib/concerts/read")
    const result = await getEffectiveBandsForForm(concert as any, attendance)
    expect(result).toHaveLength(3)
  })
})

describe("getConcertById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_getConcertById_not_found_returns_null", async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null)
    const { getConcertById } = await import("@/lib/concerts/read")
    const result = await getConcertById("nonexistent-id")
    expect(result).toBeNull()
  })
})

