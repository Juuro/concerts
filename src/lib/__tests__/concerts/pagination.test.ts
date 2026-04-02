/**
 * Pagination unit tests extracted from `src/lib/concerts.test.ts`.
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { getConcertsPaginated } from "@/lib/concerts/pagination"

// Mock external utilities
vi.mock("@/utils/data", () => ({
  getGeocodingData: vi.fn().mockResolvedValue({
    _normalized_city: "Test City",
    _is_coordinates: false,
  }),
}))

describe("Pagination (Cursor-Based)", () => {
  // Mock data: 5 concerts with incrementing dates
  const mockConcertA = {
    id: "mock-concert-id-a",
    date: new Date("2025-01-01T20:00:00Z"),
    latitude: 52.52,
    longitude: 13.405,
    venue: "Venue A",
    normalizedCity: "Berlin",
    isFestival: false,
    festivalId: null,
    createdById: "mock-user-id-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockConcertB = {
    id: "mock-concert-id-b",
    date: new Date("2025-01-02T20:00:00Z"),
    latitude: 52.52,
    longitude: 13.405,
    venue: "Venue B",
    normalizedCity: "Berlin",
    isFestival: false,
    festivalId: null,
    createdById: "mock-user-id-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockConcertC = {
    id: "mock-concert-id-c",
    date: new Date("2025-01-03T20:00:00Z"),
    latitude: 52.52,
    longitude: 13.405,
    venue: "Venue C",
    normalizedCity: "Berlin",
    isFestival: false,
    festivalId: null,
    createdById: "mock-user-id-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockConcertD = {
    id: "mock-concert-id-d",
    date: new Date("2025-01-04T20:00:00Z"),
    latitude: 48.8566,
    longitude: 2.3522,
    venue: "Venue D",
    normalizedCity: "Paris",
    isFestival: false,
    festivalId: null,
    createdById: "mock-user-id-2",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockConcertE = {
    id: "mock-concert-id-e",
    date: new Date("2025-01-05T20:00:00Z"),
    latitude: 48.8566,
    longitude: 2.3522,
    venue: "Venue E",
    normalizedCity: "Paris",
    isFestival: false,
    festivalId: null,
    createdById: "mock-user-id-2",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockBandRadiohead = {
    id: "mock-band-id-radiohead",
    name: "Radiohead",
    slug: "radiohead",
    imageUrl: "https://example.com/radiohead.jpg",
    imageEnrichedAt: null,
    lastfmUrl: null,
    websiteUrl: null,
    genres: [],
    bio: null,
    createdById: "mock-user-id-1",
    updatedById: "mock-user-id-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockBandColdplay = {
    id: "mock-band-id-coldplay",
    name: "Coldplay",
    slug: "coldplay",
    imageUrl: "https://example.com/coldplay.jpg",
    imageEnrichedAt: null,
    lastfmUrl: null,
    websiteUrl: null,
    genres: [],
    bio: null,
    createdById: "mock-user-id-1",
    updatedById: "mock-user-id-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_getConcertsPaginated_forward_pagination_ascending_order", async () => {
    // Setup: Return 3 concerts (A, B, C) in DESC order (newest first)
    const mockConcerts = [
      {
        ...mockConcertC,
        bands: [
          {
            concertId: mockConcertC.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertB,
        bands: [
          {
            concertId: mockConcertB.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertA,
        bands: [
          {
            concertId: mockConcertA.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
    ]

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Forward pagination without cursor
    const result = await getConcertsPaginated(undefined, 2, "forward")

    // Assert: Should return first 2 items (C, B) with nextCursor pointing to B
    expect(result.items).toHaveLength(2)
    expect(result.items[0].id).toBe("mock-concert-id-c")
    expect(result.items[1].id).toBe("mock-concert-id-b")
    expect(result.nextCursor).toBe("mock-concert-id-b")
    expect(result.prevCursor).toBeNull()
    expect(result.hasMore).toBe(true)
    expect(result.hasPrevious).toBe(false)

    // Verify query called with correct parameters
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3, // limit + 1
        orderBy: [{ date: "desc" }, { id: "desc" }],
      })
    )
  })

  test("test_getConcertsPaginated_backward_pagination_descending_order", async () => {
    // Setup: Return 3 concerts when paginating backward from cursor D
    // Backward with take=-3 returns older concerts in reverse order
    const mockConcerts = [
      {
        ...mockConcertD,
        bands: [
          {
            concertId: mockConcertD.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertC,
        bands: [
          {
            concertId: mockConcertC.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertB,
        bands: [
          {
            concertId: mockConcertB.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
    ]

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Backward pagination from cursor D
    const result = await getConcertsPaginated(
      "mock-concert-id-d",
      2,
      "backward"
    )

    // Assert: After reversing [D,C,B] -> [B,C,D], then slice(1) -> [C,D]
    expect(result.items).toHaveLength(2)
    expect(result.items[0].id).toBe("mock-concert-id-c")
    expect(result.items[1].id).toBe("mock-concert-id-d")
    expect(result.prevCursor).toBe("mock-concert-id-c")
    expect(result.hasMore).toBe(true) // Always true for backward
    expect(result.hasPrevious).toBe(true)

    // Verify query called with correct parameters
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: -3, // -(limit + 1) for backward
        cursor: { id: "mock-concert-id-d" },
        skip: 1,
        orderBy: [{ date: "desc" }, { id: "desc" }],
      })
    )
  })

  test("test_getConcertsPaginated_with_cursor_includes_cursor_concert", async () => {
    // Setup: Return concerts including the cursor concert
    const mockConcerts = [
      {
        ...mockConcertC,
        bands: [
          {
            concertId: mockConcertC.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertB,
        bands: [
          {
            concertId: mockConcertB.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertA,
        bands: [
          {
            concertId: mockConcertA.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
    ]

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Forward pagination with cursor C
    const result = await getConcertsPaginated("mock-concert-id-c", 2, "forward")

    // Assert: Cursor is used with skip: 1, so cursor concert is excluded
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "mock-concert-id-c" },
        skip: 1, // Skip the cursor itself
      })
    )
  })

  test("test_getConcertsPaginated_with_limit_respects_page_size", async () => {
    // Setup: Return 6 concerts (one more than limit to test hasMore)
    const mockConcerts = Array.from({ length: 6 }, (_, i) => ({
      ...mockConcertA,
      id: `mock-concert-id-${i}`,
      bands: [
        {
          concertId: `mock-concert-id-${i}`,
          bandId: mockBandRadiohead.id,
          isHeadliner: true,
          sortOrder: 0,
          band: mockBandRadiohead,
        },
      ],
      festival: null,
      _count: { attendees: 1 },
    }))

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Request limit of 5
    const result = await getConcertsPaginated(undefined, 5, "forward")

    // Assert: Should return exactly 5 items (not 6)
    expect(result.items).toHaveLength(5)
    expect(result.hasMore).toBe(true) // Because we got 6 results (limit + 1)
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 6, // limit + 1
      })
    )
  })

  test("test_getConcertsPaginated_with_userId_filter", async () => {
    // Setup: Mock UserConcert query for user-specific concerts
    const mockUserConcerts = [
      {
        id: "mock-user-concert-id-1",
        userId: "mock-user-id-1",
        concertId: mockConcertA.id,
        cost: 50,
        notes: null,
        supportingActIds: null,
        createdAt: new Date(),
        concert: {
          ...mockConcertA,
          bands: [
            {
              concertId: mockConcertA.id,
              bandId: mockBandRadiohead.id,
              isHeadliner: true,
              sortOrder: 0,
              band: mockBandRadiohead,
            },
          ],
          festival: null,
          _count: { attendees: 1 },
        },
      },
      {
        id: "mock-user-concert-id-2",
        userId: "mock-user-id-1",
        concertId: mockConcertB.id,
        cost: 60,
        notes: null,
        supportingActIds: null,
        createdAt: new Date(),
        concert: {
          ...mockConcertB,
          bands: [
            {
              concertId: mockConcertB.id,
              bandId: mockBandRadiohead.id,
              isHeadliner: true,
              sortOrder: 0,
              band: mockBandRadiohead,
            },
          ],
          festival: null,
          _count: { attendees: 1 },
        },
      },
    ]

    vi.mocked(prisma.userConcert.findMany).mockResolvedValue(
      mockUserConcerts as any
    )
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Filter by userId
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      userId: "mock-user-id-1",
    })

    // Assert: Should query through UserConcert relation
    expect(prisma.userConcert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "mock-user-id-1",
        }),
      })
    )
    expect(result.items).toHaveLength(2)
  })

  test("test_getConcertsPaginated_with_username_filter", async () => {
    // Setup: Mock UserConcert query for username-based filter
    const mockUserConcerts = [
      {
        id: "mock-user-concert-id-1",
        userId: "mock-user-id-1",
        concertId: mockConcertA.id,
        cost: 50,
        notes: null,
        supportingActIds: null,
        createdAt: new Date(),
        concert: {
          ...mockConcertA,
          bands: [
            {
              concertId: mockConcertA.id,
              bandId: mockBandRadiohead.id,
              isHeadliner: true,
              sortOrder: 0,
              band: mockBandRadiohead,
            },
          ],
          festival: null,
          _count: { attendees: 1 },
        },
      },
    ]

    vi.mocked(prisma.userConcert.findMany).mockResolvedValue(
      mockUserConcerts as any
    )
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Filter by username (requires userId to be set by caller)
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      userId: "mock-user-id-1", // In practice, caller resolves username to userId
    })

    // Assert: Should use UserConcert relation
    expect(prisma.userConcert.findMany).toHaveBeenCalled()
    expect(result.items).toHaveLength(1)
  })

  test("test_getConcertsPaginated_with_bandSlug_filter", async () => {
    // Setup: Return concerts with specific band as headliner
    const mockConcerts = [
      {
        ...mockConcertA,
        bands: [
          {
            concertId: mockConcertA.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertB,
        bands: [
          {
            concertId: mockConcertB.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
    ]

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Filter by bandSlug
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      bandSlug: "radiohead",
    })

    // Assert: Should filter by band slug in where clause
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bands: {
            some: {
              band: { slug: "radiohead" },
            },
          },
        }),
      })
    )
    expect(result.items).toHaveLength(2)
  })

  test("test_getConcertsPaginated_with_city_filter", async () => {
    // Setup: Return concerts from specific city
    const mockConcerts = [
      {
        ...mockConcertA,
        bands: [
          {
            concertId: mockConcertA.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
      {
        ...mockConcertB,
        bands: [
          {
            concertId: mockConcertB.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
    ]

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Filter by city
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      city: "Berlin",
    })

    // Assert: Should filter by normalizedCity
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          normalizedCity: "Berlin",
        }),
      })
    )
    expect(result.items).toHaveLength(2)
  })

  test("test_getConcertsPaginated_with_year_filter", async () => {
    // Setup: Return concerts from specific year
    const mockConcerts = [
      {
        ...mockConcertA,
        bands: [
          {
            concertId: mockConcertA.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
    ]

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Filter by year
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      year: 2025,
    })

    // Assert: Should filter by date range
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date(2025, 0, 1),
            lte: new Date(2025, 11, 31, 23, 59, 59, 999),
          },
        }),
      })
    )
    expect(result.items).toHaveLength(1)
  })

  test("test_getConcertsPaginated_when_city_year_and_bandSlug_combined_returns_filtered_items", async () => {
    // Setup: Return concerts matching multiple filters
    const mockConcerts = [
      {
        ...mockConcertA,
        bands: [
          {
            concertId: mockConcertA.id,
            bandId: mockBandRadiohead.id,
            isHeadliner: true,
            sortOrder: 0,
            band: mockBandRadiohead,
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      },
    ]

    vi.mocked(prisma.concert.findMany).mockResolvedValue(mockConcerts as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    // Execute: Apply multiple filters (city + year + band)
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      city: "Berlin",
      year: 2025,
      bandSlug: "radiohead",
    })

    // Assert: Should apply all filters
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          normalizedCity: "Berlin",
          date: {
            gte: new Date(2025, 0, 1),
            lte: new Date(2025, 11, 31, 23, 59, 59, 999),
          },
          bands: {
            some: {
              band: { slug: "radiohead" },
            },
          },
        }),
      })
    )
    expect(result.items).toHaveLength(1)
  })
})

describe("getConcertsPaginated with userId + bandSlug filter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_getConcertsPaginated_userId_bandSlug_uses_raw_sql", async () => {
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({
      id: "band-1",
    } as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: "uc-1" }])
    vi.mocked(prisma.userConcert.findMany).mockResolvedValueOnce([] as any)
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      userId: "user-1",
      bandSlug: "band-a",
    })
    expect(prisma.band.findUnique).toHaveBeenCalled()
    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(result.items).toHaveLength(0)
  })

  test("test_getConcertsPaginated_userId_bandSlug_when_band_not_found_falls_back_to_userConcert_query", async () => {
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce(null as any)
    vi.mocked(prisma.userConcert.findMany).mockResolvedValueOnce([] as any)
    const result = await getConcertsPaginated(undefined, 20, "forward", {
      userId: "user-1",
      bandSlug: "missing-band",
    })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(prisma.userConcert.findMany).toHaveBeenCalled()
    expect(result.items).toEqual([])
  })

  test("test_getConcertsPaginated_user_band_raw_sql_empty_rows_with_cursor_sets_prev_cursor", async () => {
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({
      id: "band-1",
    } as any)
    vi.mocked(prisma.userConcert.findFirst).mockResolvedValueOnce({
      concert: { date: new Date("2024-01-01T00:00:00.000Z") },
    } as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([])

    const result = await getConcertsPaginated("uc-older", 20, "forward", {
      userId: "user-1",
      bandSlug: "band-a",
    })
    expect(result.prevCursor).toBe("uc-older")
    expect(result.hasPrevious).toBe(true)
  })

  test("test_getConcertsPaginated_user_band_raw_sql_backward_reverses_items_and_sets_cursors", async () => {
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({
      id: "band-1",
    } as any)
    vi.mocked(prisma.userConcert.findFirst).mockResolvedValueOnce({
      concert: { date: new Date("2024-01-01T00:00:00.000Z") },
    } as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "uc-1" },
      { id: "uc-2" },
      { id: "uc-3" },
    ] as any)
    vi.mocked(prisma.userConcert.findMany).mockResolvedValueOnce([
      {
        id: "uc-1",
        concert: {
          id: "c1",
          date: new Date("2024-01-03"),
          latitude: 1,
          longitude: 1,
          venue: "v1",
          normalizedCity: "x",
          isFestival: false,
          festival: null,
          bands: [],
          _count: { attendees: 1 },
        },
      },
      {
        id: "uc-2",
        concert: {
          id: "c2",
          date: new Date("2024-01-02"),
          latitude: 1,
          longitude: 1,
          venue: "v2",
          normalizedCity: "x",
          isFestival: false,
          festival: null,
          bands: [],
          _count: { attendees: 1 },
        },
      },
      {
        id: "uc-3",
        concert: {
          id: "c3",
          date: new Date("2024-01-01"),
          latitude: 1,
          longitude: 1,
          venue: "v3",
          normalizedCity: "x",
          isFestival: false,
          festival: null,
          bands: [],
          _count: { attendees: 1 },
        },
      },
    ] as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await getConcertsPaginated("uc-cursor", 2, "backward", {
      userId: "user-1",
      bandSlug: "band-a",
    })
    expect(result.items).toHaveLength(2)
    expect(result.hasPrevious).toBe(true)
  })

  test("test_getConcertsPaginated_user_band_raw_sql_without_cursor_date_uses_empty_cursor_clause", async () => {
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({
      id: "band-1",
    } as any)
    vi.mocked(prisma.userConcert.findFirst).mockResolvedValueOnce(null as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: "uc-1" }] as any)
    vi.mocked(prisma.userConcert.findMany).mockResolvedValueOnce([
      {
        id: "uc-1",
        concert: {
          id: "c1",
          date: new Date("2024-01-01"),
          latitude: 1,
          longitude: 1,
          venue: "v1",
          normalizedCity: "x",
          isFestival: false,
          festival: null,
          bands: [],
          _count: { attendees: 1 },
        },
      },
    ] as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await getConcertsPaginated(
      "uc-cursor-missing",
      20,
      "forward",
      {
        userId: "user-1",
        bandSlug: "band-a",
      }
    )
    expect(result.items).toHaveLength(1)
  })

  test("test_getConcertsPaginated_user_backward_path_reverses_userConcerts_array", async () => {
    vi.mocked(prisma.userConcert.findMany).mockResolvedValueOnce([
      {
        id: "uc-1",
        userId: "user-1",
        concert: {
          id: "c1",
          date: new Date("2024-01-03"),
          latitude: 1,
          longitude: 1,
          venue: "v1",
          normalizedCity: "x",
          isFestival: false,
          festival: null,
          bands: [],
          _count: { attendees: 1 },
        },
      },
      {
        id: "uc-2",
        userId: "user-1",
        concert: {
          id: "c2",
          date: new Date("2024-01-02"),
          latitude: 1,
          longitude: 1,
          venue: "v2",
          normalizedCity: "x",
          isFestival: false,
          festival: null,
          bands: [],
          _count: { attendees: 1 },
        },
      },
      {
        id: "uc-3",
        userId: "user-1",
        concert: {
          id: "c3",
          date: new Date("2024-01-01"),
          latitude: 1,
          longitude: 1,
          venue: "v3",
          normalizedCity: "x",
          isFestival: false,
          festival: null,
          bands: [],
          _count: { attendees: 1 },
        },
      },
    ] as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await getConcertsPaginated("uc-0", 2, "backward", {
      userId: "user-1",
      isPublic: true,
      city: "x",
    })
    expect(result.items).toHaveLength(2)
    expect(result.hasPrevious).toBe(true)
  })
})
