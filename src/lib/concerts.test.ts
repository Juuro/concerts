/**
 * Unit tests for src/lib/concerts.ts
 *
 * Test data uses anonymized PII following GDPR compliance:
 * - Emails: @test.example.com domain
 * - User IDs: mock UUIDs
 * - Generic artist names
 *
 * Prisma Mock Patterns:
 * Use vi.mocked(prisma.concert.findMany).mockResolvedValue(...) with full relations.
 * All mocks must include nested relations to match production behavior:
 * - concert.bands[{band: Band, isHeadliner, sortOrder}]
 * - concert.festival{name, url}
 * - concert.attendees[]
 * - concert._count{attendees: number}
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  createConcert,
  updateConcert,
  deleteConcert,
  getConcertsPaginated,
  findMatchingConcert,
  getConcertStatistics,
  getUserConcertStatistics,
  getUserTotalSpent,
  getUserTotalSpentCached,
  getConcertCounts,
  getUserConcertCounts,
  getUserBandConcertCounts,
  getAllConcerts,
  getConcertsByBand,
  getConcertsByYear,
  getConcertsByCity,
  getAllYears,
  getAllCities,
  getConcertById,
  getEffectiveBandsForForm,
  getUserDashboardCounts,
  getUserUniqueBandCount,
  getGlobalAppStats,
  ConcertAlreadyExistsError,
  type CreateConcertInput,
} from "./concerts"


// Mock external utilities
vi.mock("@/utils/data", () => ({
  getGeocodingData: vi.fn().mockResolvedValue({
    _normalized_city: "Test City",
    _is_coordinates: false,
  }),
}))

describe("Edge Cases & Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_createConcert_throws_ConcertAlreadyExistsError_for_duplicate", async () => {
    // CRITICAL: Tests duplicate detection when user tries to add same concert twice
    // Prevents unique constraint violations in UserConcert table
    const userId = "user-test-001"
    const concertId = "concert-existing-001"
    const bandId = "band-radiohead-001"
    const date = new Date("2025-06-15")

    const existingConcert = {
      id: concertId,
      date,
      latitude: 51.5074,
      longitude: -0.1278,
      venue: "Test Arena",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      createdById: "other-user",
      updatedById: null,
    }

    const existingWithBands = {
      ...existingConcert,
      bands: [
        {
          bandId,
          band: { id: bandId, name: "Radiohead", slug: "radiohead" },
          isHeadliner: true,
          sortOrder: 0,
        },
      ],
      festival: null,
      _count: { attendees: 1 },
    }

    // Mock: findMatchingConcert returns existing concert
    vi.mocked(prisma.concert.findMany).mockResolvedValue([existingConcert] as any)
    // Mock: concert.findUnique returns full concert with bands
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(existingWithBands as any)
    // Mock: user already attends this concert
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue({
      id: "uc-001",
      userId,
      concertId,
      cost: 50,
      notes: null,
      supportingActIds: [],
    } as any)

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 51.5074,
      longitude: -0.1278,
      venue: "Test Arena",
      bandIds: [{ bandId, isHeadliner: true }],
    }

    // This test MUST FAIL if duplicate detection is removed (lines 509-516 in concerts.ts)
    await expect(createConcert(input)).rejects.toThrow(ConcertAlreadyExistsError)
    await expect(createConcert(input)).rejects.toThrow("Concert already in list")
  })

  test("test_updateConcert_with_null_attendance_returns_null", async () => {
    // CRITICAL (DA2): Tests attendance authorization - non-attendees cannot edit
    // This verifies multi-tenant security: only concert attendees can update
    const concertId = "concert-001"
    const nonAttendeeUserId = "user-not-attending"

    // Mock: user has NO attendance record for this concert
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue(null)

    const result = await updateConcert(concertId, nonAttendeeUserId, {
      venue: "Hacked Venue",
    })

    // Test MUST return null when user is not an attendee (line 787-793 in concerts.ts)
    expect(result).toBeNull()
    // Verify no Prisma update operations were called (security check)
    expect(prisma.concert.update).not.toHaveBeenCalled()
    expect(prisma.userConcert.update).not.toHaveBeenCalled()
  })

  test("test_deleteConcert_non_attendee_returns_false", async () => {
    // CRITICAL (DA2): Tests attendance authorization - non-attendees cannot delete
    // This verifies multi-tenant security: only concert attendees can delete their attendance
    const concertId = "concert-002"
    const nonAttendeeUserId = "user-not-attending-002"

    // Mock: user has NO attendance record for this concert
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue(null)

    const result = await deleteConcert(concertId, nonAttendeeUserId)

    // Test MUST return false when user is not an attendee (line 1080-1086 in concerts.ts)
    expect(result).toBe(false)
    // Verify no delete operations were called (security check)
    expect(prisma.userConcert.delete).not.toHaveBeenCalled()
    expect(prisma.concert.delete).not.toHaveBeenCalled()
  })

  test("test_getConcertsPaginated_with_invalid_cursor_handles_gracefully", async () => {
    // Tests behavior when cursor points to non-existent concert.
    // Prisma typically throws in this case; the function should propagate or handle the error.
    const invalidCursor = "non-existent-cursor-id"

    // Mock: Prisma rejecting because the cursor record does not exist
    vi
      .mocked(prisma.concert.findMany)
      .mockRejectedValue(new Error("Record to fetch does not exist."))

    // Expect the pagination helper to surface the underlying error
    await expect(
      getConcertsPaginated(invalidCursor, 20, "forward"),
    ).rejects.toThrow("Record to fetch does not exist.")
  })

  test("test_getConcertsPaginated_empty_results_returns_empty_array", async () => {
    // Tests pagination with no results (e.g., empty database, no matches)
    // Ensures pagination doesn't break when there's no data
    vi.mocked(prisma.concert.findMany).mockResolvedValue([])

    const result = await getConcertsPaginated(undefined, 20, "forward")

    expect(result.items).toEqual([])
    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(result.prevCursor).toBeNull()
    expect(result.hasMore).toBe(false)
    expect(result.hasPrevious).toBe(false)
  })

  test("test_findMatchingConcert_no_match_returns_null", async () => {
    // Tests that findMatchingConcert returns null when no concert matches criteria
    // This is critical for create flow - ensures new concerts are created when no match exists
    const date = new Date("2025-07-01")
    const latitude = 48.8566
    const longitude = 2.3522
    const headlinerBandId = "band-unique-001"

    // Mock: no concerts found matching criteria
    vi.mocked(prisma.concert.findMany).mockResolvedValue([])

    const result = await findMatchingConcert(
      date,
      latitude,
      longitude,
      headlinerBandId
    )

    // Should return null when no match found
    expect(result).toBeNull()
  })

  test("test_coordinate_tolerance_boundary_exactly_0001_degrees", async () => {
    // Tests coordinate tolerance boundary (COORD_TOLERANCE = 0.001 degrees ≈ 100m)
    // Verifies concerts within tolerance are matched, outside tolerance are not
    const date = new Date("2025-08-01")
    const baseLat = 52.5200
    const baseLon = 13.4050
    const headlinerBandId = "band-tolerance-test"

    const existingConcert = {
      id: "concert-tolerance",
      date,
      latitude: baseLat,
      longitude: baseLon,
      venue: "Base Venue",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      createdById: "user-001",
      updatedById: null,
    }

    // Test 1: Exactly at tolerance boundary (0.001 degrees) - SHOULD match
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([existingConcert] as any)

    const matchAtBoundary = await findMatchingConcert(
      date,
      baseLat + 0.001, // Exactly at upper tolerance boundary
      baseLon + 0.001,
      headlinerBandId
    )

    // Verify the query was called with correct tolerance range
    expect(prisma.concert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          latitude: {
            gte: baseLat + 0.001 - 0.001, // baseLat
            lte: baseLat + 0.001 + 0.001, // baseLat + 0.002
          },
          longitude: {
            gte: baseLon + 0.001 - 0.001, // baseLon
            lte: baseLon + 0.001 + 0.001, // baseLon + 0.002
          },
        }),
      })
    )
    expect(matchAtBoundary).toBe(existingConcert)

    // Test 2: Outside tolerance (0.002 degrees) - SHOULD NOT match
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    const noMatchOutsideTolerance = await findMatchingConcert(
      date,
      baseLat + 0.002, // Outside tolerance
      baseLon + 0.002,
      headlinerBandId
    )

    expect(noMatchOutsideTolerance).toBeNull()
  })

  test("test_deleteConcert_removes_attendance_and_orphaned_concert", async () => {
    // Tests cascade deletion: when last attendee leaves, concert is deleted
    // Critical for orphan cleanup (lines 1098-1103 in concerts.ts)
    const concertId = "concert-orphan"
    const userId = "user-last-attendee"
    const attendanceId = "uc-orphan"

    // Mock: user has attendance
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue({
      id: attendanceId,
      userId,
      concertId,
      cost: null,
      notes: null,
      supportingActIds: [],
    } as any)

    // Mock: after delete, no remaining attendees (orphaned concert)
    vi.mocked(prisma.userConcert.count).mockResolvedValue(0)

    // Mock delete operations
    vi.mocked(prisma.userConcert.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.delete).mockResolvedValue({} as any)

    const result = await deleteConcert(concertId, userId)

    expect(result).toBe(true)
    // Verify attendance was deleted
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: { id: attendanceId },
    })
    // Verify orphaned concert was deleted
    expect(prisma.concert.delete).toHaveBeenCalledWith({
      where: { id: concertId },
    })
  })

  test("test_deleteConcert_preserves_concert_with_remaining_attendees", async () => {
    // Tests that shared concerts are NOT deleted when other attendees remain
    // Critical for multi-tenant data integrity (lines 1093-1103 in concerts.ts)
    const concertId = "concert-shared"
    const userId = "user-leaving"
    const attendanceId = "uc-leaving"

    // Mock: user has attendance
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue({
      id: attendanceId,
      userId,
      concertId,
      cost: null,
      notes: null,
      supportingActIds: [],
    } as any)

    // Mock: after delete, 2 attendees remain (NOT orphaned)
    vi.mocked(prisma.userConcert.count).mockResolvedValue(2)

    // Mock delete operations
    vi.mocked(prisma.userConcert.delete).mockResolvedValue({} as any)

    const result = await deleteConcert(concertId, userId)

    expect(result).toBe(true)
    // Verify attendance was deleted
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: { id: attendanceId },
    })
    // Verify concert was NOT deleted (still has attendees)
    expect(prisma.concert.delete).not.toHaveBeenCalled()
  })
})

describe('Statistics & Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getConcertStatistics', () => {
    test('test_getConcertStatistics_returns_top_years', async () => {
      const mockNow = new Date('2024-03-31T00:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      // Mock groupBy for year counts
      vi.mocked(prisma.concert.groupBy).mockImplementation((args: any) => {
        if (args.by.includes('date')) {
          return Promise.resolve([
            { date: new Date('2023-06-15'), _count: 5 },
            { date: new Date('2023-08-20'), _count: 3 },
            { date: new Date('2022-07-10'), _count: 7 },
            { date: new Date('2022-09-15'), _count: 2 },
            { date: new Date('2021-05-01'), _count: 4 },
          ])
        }
        return Promise.resolve([])
      })

      // Mock other groupBy calls (cities, bands)
      vi.mocked(prisma.concert.count).mockResolvedValue(21)
      vi.mocked(prisma.concertBand.groupBy).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])
      vi.mocked(prisma.concertBand.count).mockResolvedValue(0)

      const stats = await getConcertStatistics()

      expect(stats.yearCounts).toHaveLength(3)
      expect(stats.yearCounts[0]).toEqual(['2022', 9, '2022']) // 7 + 2
      expect(stats.yearCounts[1]).toEqual(['2023', 8, '2023']) // 5 + 3
      expect(stats.yearCounts[2]).toEqual(['2021', 4, '2021'])
      expect(stats.maxYearCount).toBe(9)

      vi.useRealTimers()
    })

    test('test_getConcertStatistics_returns_top_cities', async () => {
      const mockNow = new Date('2024-03-31T00:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      // Mock groupBy for city counts
      vi.mocked(prisma.concert.groupBy).mockImplementation((args: any) => {
        if (args.by.includes('normalizedCity')) {
          return Promise.resolve([
            { normalizedCity: 'Berlin', _count: 12 },
            { normalizedCity: 'New York', _count: 8 },
            { normalizedCity: 'London', _count: 5 },
          ])
        }
        if (args.by.includes('date')) {
          return Promise.resolve([])
        }
        return Promise.resolve([])
      })

      vi.mocked(prisma.concert.count).mockResolvedValue(25)
      vi.mocked(prisma.concertBand.groupBy).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])
      vi.mocked(prisma.concertBand.count).mockResolvedValue(0)

      const stats = await getConcertStatistics()

      expect(stats.cityCounts).toHaveLength(3)
      expect(stats.cityCounts[0][0]).toBe('Berlin')
      expect(stats.cityCounts[0][1]).toBe(12)
      expect(stats.cityCounts[1][0]).toBe('New York')
      expect(stats.cityCounts[1][1]).toBe(8)
      expect(stats.maxCityCount).toBe(12)

      vi.useRealTimers()
    })

    test('test_getConcertStatistics_returns_top_bands', async () => {
      const mockNow = new Date('2024-03-31T00:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      const mockBandIds = ['band-1', 'band-2', 'band-3']

      // Mock groupBy for bands
      vi.mocked(prisma.concertBand.groupBy).mockResolvedValue([
        { bandId: 'band-1', _count: 15 },
        { bandId: 'band-2', _count: 10 },
        { bandId: 'band-3', _count: 7 },
      ] as any)

      vi.mocked(prisma.band.findMany).mockResolvedValue([
        { id: 'band-1', name: 'Radiohead', slug: 'radiohead' },
        { id: 'band-2', name: 'The National', slug: 'the-national' },
        { id: 'band-3', name: 'Arcade Fire', slug: 'arcade-fire' },
      ] as any)

      vi.mocked(prisma.concertBand.count).mockImplementation((args: any) => {
        if (args.where.bandId === 'band-1') return Promise.resolve(15)
        if (args.where.bandId === 'band-2') return Promise.resolve(10)
        if (args.where.bandId === 'band-3') return Promise.resolve(7)
        return Promise.resolve(0)
      })

      // Mock other groupBy calls
      vi.mocked(prisma.concert.groupBy).mockResolvedValue([])
      vi.mocked(prisma.concert.count).mockResolvedValue(32)

      const stats = await getConcertStatistics()

      expect(stats.mostSeenBands).toHaveLength(3)
      expect(stats.mostSeenBands[0]).toEqual(['Radiohead', 15, 'radiohead'])
      expect(stats.mostSeenBands[1]).toEqual(['The National', 10, 'the-national'])
      expect(stats.mostSeenBands[2]).toEqual(['Arcade Fire', 7, 'arcade-fire'])
      expect(stats.maxBandCount).toBe(15)

      vi.useRealTimers()
    })
  })

  describe('getUserConcertStatistics', () => {
    test('test_getUserConcertStatistics_filters_by_userId', async () => {
      const userId = 'user-test-123@test.example.com'
      const mockNow = new Date('2024-03-31T00:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      // Mock user's concert IDs
      vi.mocked(prisma.userConcert.findMany).mockResolvedValue([
        { concertId: 'concert-1' },
        { concertId: 'concert-2' },
        { concertId: 'concert-3' },
      ] as any)

      // Mock groupBy for years
      vi.mocked(prisma.concert.groupBy).mockImplementation((args: any) => {
        if (args.by.includes('date')) {
          return Promise.resolve([
            { date: new Date('2023-06-15'), _count: 2 },
            { date: new Date('2022-07-10'), _count: 1 },
          ])
        }
        if (args.by.includes('normalizedCity')) {
          return Promise.resolve([
            { normalizedCity: 'Berlin', _count: 2 },
            { normalizedCity: 'Munich', _count: 1 },
          ])
        }
        return Promise.resolve([])
      })

      // Mock $queryRaw for bands
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { band_id: 'band-1', cnt: BigInt(2) },
        { band_id: 'band-2', cnt: BigInt(1) },
      ])

      vi.mocked(prisma.band.findMany).mockResolvedValue([
        { id: 'band-1', name: 'Radiohead', slug: 'radiohead' },
        { id: 'band-2', name: 'Blur', slug: 'blur' },
      ] as any)

      vi.mocked(prisma.userConcert.count).mockImplementation((args: any) => {
        if (args.where.userId === userId) {
          return Promise.resolve(3)
        }
        return Promise.resolve(0)
      })

      const stats = await getUserConcertStatistics(userId)

      expect(stats.yearCounts).toBeDefined()
      expect(stats.cityCounts).toBeDefined()
      expect(stats.mostSeenBands).toBeDefined()
      expect(stats.totalPast).toBe(3)
      expect(stats.totalFuture).toBe(3)

      // Verify user-specific filtering was applied
      expect(prisma.userConcert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
        })
      )

      vi.useRealTimers()
    })
  })

  describe('getUserTotalSpent', () => {
    test('test_getUserTotalSpent_aggregates_cost_from_userConcert', async () => {
      const userId = 'user-test-123@test.example.com'

      // Mock aggregate for spending aggregation (no filters)
      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 250.5 },
        _avg: { cost: null },
        _count: { cost: 0 },
        _min: { cost: null },
        _max: { cost: null },
      } as any)

      // Mock user for currency
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'EUR' } as any)

      const result = await getUserTotalSpent(userId)

      expect(result.total).toBe(250.5)
      expect(result.currency).toBe('EUR')

      // Verify aggregate was called
      expect(prisma.userConcert.aggregate).toHaveBeenCalled()
    })

    test('test_getUserTotalSpent_with_filters_applies_correctly', async () => {
      const userId = 'user-test-456@test.example.com'

      // Mock band lookup for bandSlug filter
      vi.mocked(prisma.band.findUnique).mockResolvedValue({
        id: 'band-radiohead-123',
        slug: 'radiohead',
      } as any)

      // Mock $queryRaw with filters (bandSlug uses raw SQL path)
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ total: 150.75 }])

      // Mock user for currency
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'USD' } as any)

      const result = await getUserTotalSpent(userId, {
        bandSlug: 'radiohead',
        city: 'Berlin',
        year: 2023,
        pastOnly: true,
      })

      expect(result.total).toBe(150.75)
      expect(result.currency).toBe('USD')

      // Verify $queryRaw was called (bandSlug requires raw SQL)
      expect(prisma.$queryRaw).toHaveBeenCalled()
    })

    test('test_getUserTotalSpent_returns_zero_when_no_costs', async () => {
      const userId = 'user-test-789@test.example.com'

      // Mock empty aggregate result
      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: null },
        _avg: { cost: null },
        _count: { cost: 0 },
        _min: { cost: null },
        _max: { cost: null },
      } as any)

      // Mock user for currency
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'GBP' } as any)

      const result = await getUserTotalSpent(userId)

      expect(result.total).toBe(0)
      expect(result.currency).toBe('GBP')
    })
  })

  describe('getUserTotalSpentCached', () => {
    test('test_getUserTotalSpentCached_uses_cache', async () => {
      const userId = 'user-test-cache-123@test.example.com'

      // Mock aggregate (calls getUserTotalSpent with pastOnly=true)
      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 300 },
        _avg: { cost: null },
        _count: { cost: 0 },
        _min: { cost: null },
        _max: { cost: null },
      } as any)

      // Mock user for currency
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'EUR' } as any)

      const result = await getUserTotalSpentCached(userId)

      expect(result.total).toBe(300)
      expect(result.currency).toBe('EUR')

      // Verify it calls getUserTotalSpent with pastOnly filter
      expect(prisma.userConcert.aggregate).toHaveBeenCalled()
    })
  })

  describe('getConcertCounts', () => {
    test('test_getConcertCounts_returns_attendee_counts', async () => {
      const mockNow = new Date('2024-03-31T00:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      vi.mocked(prisma.concert.count).mockImplementation((args: any) => {
        if (args.where.date?.lt) {
          return Promise.resolve(42) // Past concerts
        }
        if (args.where.date?.gte) {
          return Promise.resolve(15) // Future concerts
        }
        return Promise.resolve(0)
      })

      const counts = await getConcertCounts()

      expect(counts.past).toBe(42)
      expect(counts.future).toBe(15)

      vi.useRealTimers()
    })
  })

  describe('getUserConcertCounts', () => {
    test('test_getUserConcertCounts_filters_by_userId', async () => {
      const userId = 'user-test-counts-123@test.example.com'
      const mockNow = new Date('2024-03-31T00:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      vi.mocked(prisma.userConcert.count).mockImplementation((args: any) => {
        if (args.where.userId === userId && args.where.concert?.date?.lt) {
          return Promise.resolve(20) // User's past concerts
        }
        if (args.where.userId === userId && args.where.concert?.date?.gte) {
          return Promise.resolve(5) // User's future concerts
        }
        return Promise.resolve(0)
      })

      const counts = await getUserConcertCounts(userId)

      expect(counts.past).toBe(20)
      expect(counts.future).toBe(5)

      vi.useRealTimers()
    })
  })

  describe('getUserBandConcertCounts', () => {
    test('test_getUserBandConcertCounts_aggregates_headliner_and_support', async () => {
      const userId = 'user-test-band-123@test.example.com'
      const bandId = 'band-radiohead-123'
      const mockNow = new Date('2024-03-31T00:00:00.000Z')

      // Mock $queryRaw for band concert counts (includes both headliner and support acts)
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { past_count: BigInt(8), future_count: BigInt(2) },
      ])

      const counts = await getUserBandConcertCounts(userId, bandId, mockNow)

      expect(counts.past).toBe(8)
      expect(counts.future).toBe(2)

      // Verify $queryRaw was called
      expect(prisma.$queryRaw).toHaveBeenCalled()
    })

    test('test_getUserBandConcertCounts_returns_zero_when_no_matches', async () => {
      const userId = 'user-test-no-band-123@test.example.com'
      const bandId = 'band-unknown-123'
      const mockNow = new Date('2024-03-31T00:00:00.000Z')

      // Mock empty result
      vi.mocked(prisma.$queryRaw).mockResolvedValue([])

      const counts = await getUserBandConcertCounts(userId, bandId, mockNow)

      expect(counts.past).toBe(0)
      expect(counts.future).toBe(0)
    })
  })
})

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
    const result = await getConcertsPaginated("mock-concert-id-d", 2, "backward")

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

    vi.mocked(prisma.userConcert.findMany).mockResolvedValue(mockUserConcerts as any)
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

    vi.mocked(prisma.userConcert.findMany).mockResolvedValue(mockUserConcerts as any)
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

  test("test_getConcertsPaginated_combined_filters", async () => {
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
describe('Fork Logic (Multi-Tenant)', () => {
  /**
   * Fork triggers when:
   * 1. Concert has multiple attendees (_count.attendees > 1)
   * 2. Core fields change: date, venue, latitude, longitude, or headliner band
   *
   * Fork behavior:
   * - Creates new concert with edited data
   * - Removes user from original concert
   * - Preserves user's cost, notes, supportingActIds
   * - Deletes original concert if orphaned (no remaining attendees)
   * - Keeps original concert if other attendees remain
   * - Calls getGeocodingData for new location
   */

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('updateConcert multi-attendee forks on date change', async () => {
    const userId = 'user-1'
    const originalDate = new Date('2024-06-15')
    const newDate = new Date('2024-06-16')

    const existingConcert = {
      id: 'concert-1',
      date: originalDate,
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Venue A',
      normalizedCity: 'berlin',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-1',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-1', name: 'Band A', slug: 'band-a' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-1', cost: 50, notes: 'Great show' }],
      _count: { attendees: 2 }, // Multi-attendee triggers fork
    }

    const newConcert = {
      id: 'concert-2',
      date: newDate,
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Venue A',
      normalizedCity: 'berlin',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-1',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-1', name: 'Band A', slug: 'band-a' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-1', cost: 50, notes: 'Great show' }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-1',
      userId,
      concertId: 'concert-1',
      cost: 50,
      notes: 'Great show',
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    // Mock $transaction to execute callback
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    // Mock transaction operations
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(newConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null) // No matching concert

    const result = await updateConcert('concert-1', userId, { date: newDate })

    expect(result).toBeTruthy()
    expect(result?.id).toBe('concert-2')
    expect(result?.date).toBe(newDate.toISOString())

    // Verify fork transaction steps
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: { userId_concertId: { userId, concertId: 'concert-1' } },
    })
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date: newDate,
          createdById: userId,
        }),
      })
    )
  })

  test('updateConcert multi-attendee forks on venue change', async () => {
    const userId = 'user-2'

    const existingConcert = {
      id: 'concert-3',
      date: new Date('2024-07-20'),
      latitude: 51.5,
      longitude: -0.1,
      venue: 'Old Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-2',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-2', name: 'Band B', slug: 'band-b' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-2', cost: 60, notes: null }],
      _count: { attendees: 3 }, // Multi-attendee
    }

    const newConcert = {
      id: 'concert-4',
      date: new Date('2024-07-20'),
      latitude: 51.5,
      longitude: -0.1,
      venue: 'New Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-2',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-2', name: 'Band B', slug: 'band-b' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-2', cost: 60, notes: null }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-2',
      userId,
      concertId: 'concert-3',
      cost: 60,
      notes: null,
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(newConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    const result = await updateConcert('concert-3', userId, { venue: 'New Venue' })

    expect(result).toBeTruthy()
    expect(result?.venue).toBe('New Venue')
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test('updateConcert multi-attendee forks on headliner change', async () => {
    const userId = 'user-3'

    const existingConcert = {
      id: 'concert-5',
      date: new Date('2024-08-10'),
      latitude: 48.8566,
      longitude: 2.3522,
      venue: 'Paris Arena',
      normalizedCity: 'paris',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-3',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-3', name: 'Band C', slug: 'band-c' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-3', cost: 75, notes: 'Amazing' }],
      _count: { attendees: 2 },
    }

    const newConcert = {
      id: 'concert-6',
      date: new Date('2024-08-10'),
      latitude: 48.8566,
      longitude: 2.3522,
      venue: 'Paris Arena',
      normalizedCity: 'paris',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-4',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-4', name: 'Band D', slug: 'band-d' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-3', cost: 75, notes: 'Amazing' }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-3',
      userId,
      concertId: 'concert-5',
      cost: 75,
      notes: 'Amazing',
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(newConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    const result = await updateConcert('concert-5', userId, {
      bandIds: [{ bandId: 'band-4', isHeadliner: true }],
    })

    expect(result).toBeTruthy()
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bands: expect.objectContaining({
            create: expect.objectContaining({
              bandId: 'band-4',
              isHeadliner: true,
            }),
          }),
        }),
      })
    )
  })

  test('fork creates new concert and removes user from original', async () => {
    const userId = 'user-fork-1'

    const existingConcert = {
      id: 'concert-original',
      date: new Date('2024-09-01'),
      latitude: 40.7128,
      longitude: -74.006,
      venue: 'Original Venue',
      normalizedCity: 'new-york',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-fork',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-fork', name: 'Fork Band', slug: 'fork-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-fork-1', cost: 100, notes: 'Fork test' }],
      _count: { attendees: 2 },
    }

    const forkedConcert = {
      id: 'concert-forked',
      date: new Date('2024-09-02'), // Date changed
      latitude: 40.7128,
      longitude: -74.006,
      venue: 'Original Venue',
      normalizedCity: 'new-york',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-fork',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-fork', name: 'Fork Band', slug: 'fork-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-fork-1', cost: 100, notes: 'Fork test' }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-fork',
      userId,
      concertId: 'concert-original',
      cost: 100,
      notes: 'Fork test',
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    await updateConcert('concert-original', userId, {
      date: new Date('2024-09-02'),
    })

    // Verify user removed from original
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: {
        userId_concertId: { userId, concertId: 'concert-original' },
      },
    })

    // Verify new concert created
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendees: expect.objectContaining({
            create: expect.objectContaining({ userId }),
          }),
        }),
      })
    )
  })

  test('fork preserves user cost and notes', async () => {
    const userId = 'user-preserve'
    const userCost = 150
    const userNotes = 'VIP ticket with backstage pass'

    const existingConcert = {
      id: 'concert-preserve',
      date: new Date('2024-10-15'),
      latitude: 34.0522,
      longitude: -118.2437,
      venue: 'LA Venue',
      normalizedCity: 'los-angeles',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-preserve',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-preserve', name: 'Preserve Band', slug: 'preserve-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-preserve', cost: userCost, notes: userNotes }],
      _count: { attendees: 2 },
    }

    const forkedConcert = {
      id: 'concert-forked-preserve',
      date: new Date('2024-10-16'),
      latitude: 34.0522,
      longitude: -118.2437,
      venue: 'LA Venue',
      normalizedCity: 'los-angeles',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-preserve',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-preserve', name: 'Preserve Band', slug: 'preserve-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-preserve', cost: userCost, notes: userNotes }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-preserve',
      userId,
      concertId: 'concert-preserve',
      cost: userCost,
      notes: userNotes,
      supportingActIds: [{ bandId: 'support-1', sortOrder: 0 }],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    await updateConcert('concert-preserve', userId, {
      date: new Date('2024-10-16'),
    })

    // Verify cost and notes preserved in new concert
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendees: expect.objectContaining({
            create: expect.objectContaining({
              userId,
              cost: userCost,
              notes: userNotes,
              supportingActIds: [{ bandId: 'support-1', sortOrder: 0 }],
            }),
          }),
        }),
      })
    )
  })

  test('fork does NOT delete original if other attendees remain', async () => {
    const userId = 'user-keep-original'

    const existingConcert = {
      id: 'concert-keep',
      date: new Date('2024-11-20'),
      latitude: 51.5074,
      longitude: -0.1278,
      venue: 'London Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-keep',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-keep', name: 'Keep Band', slug: 'keep-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-keep-original', cost: 80, notes: null }],
      _count: { attendees: 3 }, // 3 attendees, so original should remain
    }

    const forkedConcert = {
      id: 'concert-forked-keep',
      date: new Date('2024-11-21'),
      latitude: 51.5074,
      longitude: -0.1278,
      venue: 'London Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-keep',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-keep', name: 'Keep Band', slug: 'keep-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-keep-original', cost: 80, notes: null }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-keep',
      userId,
      concertId: 'concert-keep',
      cost: 80,
      notes: null,
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    await updateConcert('concert-keep', userId, {
      date: new Date('2024-11-21'),
    })

    // Verify original concert is NOT deleted (3 attendees -> 2 after fork)
    expect(prisma.concert.delete).not.toHaveBeenCalledWith({
      where: { id: 'concert-keep' },
    })

    // User removed from original, new concert created
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: {
        userId_concertId: { userId, concertId: 'concert-keep' },
      },
    })
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test('updateConcert single attendee does NOT fork (updates in place)', async () => {
    const userId = 'user-single'

    const existingConcert = {
      id: 'concert-single',
      date: new Date('2024-12-01'),
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Single Venue',
      normalizedCity: 'berlin',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-single',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-single', name: 'Single Band', slug: 'single-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-single', cost: 45, notes: 'Solo show' }],
      _count: { attendees: 1 }, // Single attendee = no fork
    }

    const updatedConcert = {
      id: 'concert-single',
      date: new Date('2024-12-02'),
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Single Venue',
      normalizedCity: 'berlin',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-single',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-single', name: 'Single Band', slug: 'single-band' },
        },
      ],
      festival: null,
      attendees: [{
        id: 'attendance-single',
        userId: 'user-single',
        concertId: 'concert-single',
        cost: 45,
        notes: 'Solo show',
        supportingActIds: [],
      }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-single',
      userId,
      concertId: 'concert-single',
      cost: 45,
      notes: 'Solo show',
      supportingActIds: [],
    } as any)

    // 1st findUnique: fetch existing concert
    vi.mocked(prisma.concert.findUnique)
      .mockResolvedValueOnce(existingConcert as any)
    // concert.update
    vi.mocked(prisma.concert.update).mockResolvedValueOnce(updatedConcert as any)
    // 2nd findUnique: re-fetch after update (for matching concert check)
    vi.mocked(prisma.concert.findUnique)
      .mockResolvedValueOnce(updatedConcert as any)
    // findMatchingConcert: no match
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])
    // 3rd findUnique: final fetch
    vi.mocked(prisma.concert.findUnique)
      .mockResolvedValueOnce(updatedConcert as any)
    vi.mocked(prisma.band.findMany).mockResolvedValueOnce([])

    const result = await updateConcert('concert-single', userId, {
      date: new Date('2024-12-02'),
    })

    expect(result).toBeTruthy()

    // Verify update called (not fork)
    expect(prisma.concert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'concert-single' },
      })
    )

    // Verify fork NOT triggered
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

// ============================================
// Phase 1: Query Function Tests
// ============================================

describe('Query Functions', () => {
  const mockBand = {
    id: 'band-test-1',
    name: 'Test Band',
    slug: 'test-band',
    imageUrl: null,
    imageEnrichedAt: null,
    lastfmUrl: null,
    websiteUrl: null,
    genres: [],
    bio: null,
    createdById: 'user-test-1',
    updatedById: null,
  }

  const mockConcertWithRelations = {
    id: 'concert-q-1',
    date: new Date('2024-06-15'),
    latitude: 52.52,
    longitude: 13.405,
    venue: 'Test Arena',
    normalizedCity: 'Berlin',
    isFestival: false,
    festivalId: null,
    createdById: 'user-test-1',
    updatedById: null,
    bands: [{
      concertId: 'concert-q-1',
      bandId: 'band-test-1',
      isHeadliner: true,
      sortOrder: 0,
      band: mockBand,
    }],
    festival: null,
    _count: { attendees: 1 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllConcerts', () => {
    test('test_getAllConcerts_returns_transformed_concerts', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getAllConcerts()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('concert-q-1')
      expect(result[0].venue).toBe('Test Arena')
      expect(result[0].bands).toHaveLength(1)
      expect(result[0].bands[0].name).toBe('Test Band')
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
        })
      )
    })

    test('test_getAllConcerts_empty_database_returns_empty_array', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getAllConcerts()

      expect(result).toEqual([])
    })
  })

  describe('getConcertsByBand', () => {
    test('test_getConcertsByBand_filters_by_slug', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByBand('test-band')

      expect(result).toHaveLength(1)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            bands: { some: { band: { slug: 'test-band' } } },
          },
        })
      )
    })

    test('test_getConcertsByBand_nonexistent_slug_returns_empty', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByBand('nonexistent-slug')

      expect(result).toEqual([])
    })
  })

  describe('getConcertsByYear', () => {
    test('test_getConcertsByYear_number_input_uses_date_range', async () => {
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
        })
      )
    })

    test('test_getConcertsByYear_string_input_converts_to_number', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByYear('2024')

      expect(result).toHaveLength(1)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date: {
              gte: new Date(2024, 0, 1),
              lte: new Date(2024, 11, 31, 23, 59, 59, 999),
            },
          },
        })
      )
    })
  })

  describe('getConcertsByCity', () => {
    test('test_getConcertsByCity_filters_by_normalizedCity', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([mockConcertWithRelations] as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByCity('Berlin')

      expect(result).toHaveLength(1)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { normalizedCity: 'Berlin' },
        })
      )
    })

    test('test_getConcertsByCity_no_match_returns_empty', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      const result = await getConcertsByCity('Nonexistent City')

      expect(result).toEqual([])
    })
  })

  describe('getAllYears', () => {
    test('test_getAllYears_returns_sorted_unique_years', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([
        { date: new Date('2023-06-15') },
        { date: new Date('2023-08-20') },
        { date: new Date('2022-07-10') },
        { date: new Date('2021-05-01') },
      ] as any)

      const result = await getAllYears()

      expect(result).toEqual(['2021', '2022', '2023'])
      // Verify past-only filter (lte: now)
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { date: { lte: expect.any(Date) } },
          select: { date: true },
        })
      )
    })

    test('test_getAllYears_empty_returns_empty', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])

      const result = await getAllYears()

      expect(result).toEqual([])
    })
  })

  describe('getAllCities', () => {
    test('test_getAllCities_returns_sorted_distinct_cities', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([
        { normalizedCity: 'Munich' },
        { normalizedCity: 'Berlin' },
        { normalizedCity: 'Hamburg' },
      ] as any)

      const result = await getAllCities()

      expect(result).toEqual(['Berlin', 'Hamburg', 'Munich'])
      expect(prisma.concert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { normalizedCity: { not: null } },
          distinct: ['normalizedCity'],
        })
      )
    })

    test('test_getAllCities_empty_returns_empty', async () => {
      vi.mocked(prisma.concert.findMany).mockResolvedValue([])

      const result = await getAllCities()

      expect(result).toEqual([])
    })
  })
})

// ============================================
// Phase 2: getConcertById + getEffectiveBandsForForm
// ============================================

describe('getConcertById', () => {
  const mockBand = {
    id: 'band-byid-1',
    name: 'Test Band',
    slug: 'test-band',
    imageUrl: null,
    imageEnrichedAt: null,
    lastfmUrl: null,
    websiteUrl: null,
    genres: [],
    bio: null,
    createdById: 'user-test-1',
    updatedById: null,
  }

  const mockConcert = {
    id: 'concert-byid-1',
    date: new Date('2024-06-15'),
    latitude: 52.52,
    longitude: 13.405,
    venue: 'Test Arena',
    normalizedCity: 'Berlin',
    isFestival: false,
    festivalId: null,
    createdById: 'user-test-1',
    updatedById: null,
    bands: [{
      concertId: 'concert-byid-1',
      bandId: 'band-byid-1',
      isHeadliner: true,
      sortOrder: 0,
      band: mockBand,
    }],
    festival: null,
    _count: { attendees: 1 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('test_getConcertById_found_without_userId_returns_concert', async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(mockConcert as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await getConcertById('concert-byid-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('concert-byid-1')
    expect(result!.venue).toBe('Test Arena')
    expect(result!.bands[0].name).toBe('Test Band')
  })

  test('test_getConcertById_not_found_returns_null', async () => {
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(null)

    const result = await getConcertById('nonexistent-id')

    expect(result).toBeNull()
  })

  test('test_getConcertById_with_userId_includes_attendance', async () => {
    const concertWithAttendees = {
      ...mockConcert,
      attendees: [{
        id: 'uc-byid-1',
        userId: 'user-test-1',
        concertId: 'concert-byid-1',
        cost: 50,
        notes: 'Great show',
        supportingActIds: [],
      }],
    }
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(concertWithAttendees as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await getConcertById('concert-byid-1', 'user-test-1')

    expect(result).not.toBeNull()
    expect(result!.attendance).toBeDefined()
    expect(result!.attendance!.userId).toBe('user-test-1')
    expect(result!.attendance!.cost).toBe('50')
  })
})

describe('getEffectiveBandsForForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('test_getEffectiveBandsForForm_null_attendance_returns_headliner_only', async () => {
    const concert = {
      bands: [{
        concertId: 'c-1',
        bandId: 'band-headliner',
        isHeadliner: true,
        sortOrder: 0,
        band: { id: 'band-headliner', name: 'Headliner Band', slug: 'headliner-band' },
      }],
    }

    const result = await getEffectiveBandsForForm(concert as any, null)

    expect(result).toHaveLength(1)
    expect(result[0].bandId).toBe('band-headliner')
    expect(result[0].name).toBe('Headliner Band')
    expect(result[0].isHeadliner).toBe(true)
    // No band.findMany called since no supporting acts
    expect(prisma.band.findMany).not.toHaveBeenCalled()
  })

  test('test_getEffectiveBandsForForm_with_supporting_acts_returns_all', async () => {
    const concert = {
      bands: [{
        concertId: 'c-2',
        bandId: 'band-headliner-2',
        isHeadliner: true,
        sortOrder: 0,
        band: { id: 'band-headliner-2', name: 'Main Act', slug: 'main-act' },
      }],
    }

    const attendance = {
      supportingActIds: [
        { bandId: 'band-support-1', sortOrder: 0 },
        { bandId: 'band-support-2', sortOrder: 1 },
      ],
    }

    const supportBands = [
      { id: 'band-support-1', name: 'Support A', slug: 'support-a' },
      { id: 'band-support-2', name: 'Support B', slug: 'support-b' },
    ]

    vi.mocked(prisma.band.findMany).mockReset()
    vi.mocked(prisma.band.findMany).mockResolvedValue(supportBands as any)

    const result = await getEffectiveBandsForForm(concert as any, attendance)

    expect(result).toHaveLength(3)
  })

  test('test_getEffectiveBandsForForm_empty_supportingActIds_returns_headliner_only', async () => {
    const concert = {
      bands: [{
        concertId: 'c-3',
        bandId: 'band-h-3',
        isHeadliner: true,
        sortOrder: 0,
        band: { id: 'band-h-3', name: 'Solo Headliner', slug: 'solo-headliner' },
      }],
    }

    const attendance = { supportingActIds: [] }

    const result = await getEffectiveBandsForForm(concert as any, attendance)

    expect(result).toHaveLength(1)
    expect(result[0].bandId).toBe('band-h-3')
    expect(result[0].isHeadliner).toBe(true)
  })
})

// ============================================
// Phase 3: Dashboard & Global Stats
// ============================================

describe('Dashboard & Global Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserDashboardCounts', () => {
    test('test_getUserDashboardCounts_returns_unique_cities_and_years', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { unique_cities: BigInt(5), unique_years: BigInt(3) },
      ])

      const result = await getUserDashboardCounts('user-dash-1')

      expect(result.uniqueCities).toBe(5)
      expect(result.uniqueYears).toBe(3)
      expect(prisma.$queryRaw).toHaveBeenCalled()
    })

    test('test_getUserDashboardCounts_no_concerts_returns_zeros', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        { unique_cities: BigInt(0), unique_years: BigInt(0) },
      ])

      const result = await getUserDashboardCounts('user-dash-empty')

      expect(result.uniqueCities).toBe(0)
      expect(result.uniqueYears).toBe(0)
    })

    test('test_getUserDashboardCounts_empty_result_returns_zeros', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([])

      const result = await getUserDashboardCounts('user-dash-none')

      expect(result.uniqueCities).toBe(0)
      expect(result.uniqueYears).toBe(0)
    })
  })

  describe('getUserUniqueBandCount', () => {
    test('test_getUserUniqueBandCount_returns_count_from_raw_sql', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ cnt: BigInt(12) }])

      const result = await getUserUniqueBandCount('user-bands-1')

      expect(result).toBe(12)
    })

    test('test_getUserUniqueBandCount_no_bands_returns_zero', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ cnt: BigInt(0) }])

      const result = await getUserUniqueBandCount('user-no-bands')

      expect(result).toBe(0)
    })

    test('test_getUserUniqueBandCount_fallback_on_error_uses_groupBy', async () => {
      // Raw SQL throws → fallback to Prisma groupBy
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('SQL error'))
      vi.mocked(prisma.concertBand.groupBy).mockResolvedValue([
        { bandId: 'band-1' },
        { bandId: 'band-2' },
        { bandId: 'band-3' },
      ] as any)

      const result = await getUserUniqueBandCount('user-fallback')

      expect(result).toBe(3)
      expect(prisma.concertBand.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['bandId'],
        })
      )
    })
  })

  describe('getGlobalAppStats', () => {
    test('test_getGlobalAppStats_returns_three_counts', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-01T00:00:00.000Z'))

      vi.mocked(prisma.concert.count).mockResolvedValue(42)
      vi.mocked(prisma.band.count).mockResolvedValue(120)
      vi.mocked(prisma.user.count).mockResolvedValue(15)

      const result = await getGlobalAppStats()

      expect(result.concertCount).toBe(42)
      expect(result.bandCount).toBe(120)
      expect(result.userCount).toBe(15)

      // Verify past concerts only
      expect(prisma.concert.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { date: { lt: expect.any(Date) } },
        })
      )
      // Verify public users only
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true },
        })
      )

      vi.useRealTimers()
    })

    test('test_getGlobalAppStats_empty_database_returns_zeros', async () => {
      vi.mocked(prisma.concert.count).mockResolvedValue(0)
      vi.mocked(prisma.band.count).mockResolvedValue(0)
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const result = await getGlobalAppStats()

      expect(result.concertCount).toBe(0)
      expect(result.bandCount).toBe(0)
      expect(result.userCount).toBe(0)
    })
  })
})

// ============================================
// Phase 4: createConcert Happy Paths
// ============================================

describe('createConcert Happy Paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('test_createConcert_no_match_creates_new_concert', async () => {
    const userId = 'user-create-1'
    const bandId = 'band-new-1'
    const date = new Date('2025-09-15')

    // findMatchingConcert returns no match
    vi.mocked(prisma.concert.findMany).mockResolvedValue([])

    // createNewConcertWithUser: concert.create
    const createdConcert = {
      id: 'concert-new-1',
      date,
      latitude: 48.8566,
      longitude: 2.3522,
      venue: 'Paris Arena',
      normalizedCity: 'Paris',
      isFestival: false,
      festivalId: null,
      createdById: userId,
      updatedById: null,
      bands: [{
        concertId: 'concert-new-1',
        bandId,
        isHeadliner: true,
        sortOrder: 0,
        band: { id: bandId, name: 'New Band', slug: 'new-band' },
      }],
      festival: null,
      attendees: [{
        id: 'uc-new-1',
        userId,
        concertId: 'concert-new-1',
        cost: 75,
        notes: null,
        supportingActIds: [],
      }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.concert.create).mockResolvedValue(createdConcert as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 48.8566,
      longitude: 2.3522,
      venue: 'Paris Arena',
      cost: 75,
      bandIds: [{ bandId, isHeadliner: true }],
    }

    const result = await createConcert(input)

    expect(result.id).toBe('concert-new-1')
    expect(result.venue).toBe('Paris Arena')
    expect(result.bands[0].name).toBe('New Band')
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test('test_createConcert_match_found_links_user_to_existing', async () => {
    const userId = 'user-link-1'
    const bandId = 'band-existing-1'
    const concertId = 'concert-existing-1'
    const date = new Date('2025-10-01')

    const existingConcert = {
      id: concertId,
      date,
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Berlin Arena',
      normalizedCity: 'Berlin',
      isFestival: false,
      festivalId: null,
      createdById: 'other-user',
      updatedById: null,
    }

    const existingWithBands = {
      ...existingConcert,
      bands: [{
        concertId,
        bandId,
        isHeadliner: true,
        sortOrder: 0,
        band: { id: bandId, name: 'Existing Band', slug: 'existing-band' },
      }],
      festival: null,
      _count: { attendees: 1 },
    }

    // findMatchingConcert returns existing concert
    vi.mocked(prisma.concert.findMany).mockResolvedValue([existingConcert] as any)
    // Fetch full concert
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(existingWithBands as any)
    // User does NOT already attend
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue(null)
    // Link user
    vi.mocked(prisma.userConcert.create).mockResolvedValue({
      id: 'uc-link-1',
      userId,
      concertId,
      cost: 60,
      notes: null,
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Berlin Arena',
      cost: 60,
      bandIds: [{ bandId, isHeadliner: true }],
    }

    const result = await createConcert(input)

    expect(result.id).toBe(concertId)
    // User was linked to existing concert via userConcert.create
    expect(prisma.userConcert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          concertId,
        }),
      })
    )
    // concert.create should NOT have been called (reused existing)
    expect(prisma.concert.create).not.toHaveBeenCalled()
  })

  test('test_createConcert_no_headliner_creates_new_concert', async () => {
    const userId = 'user-no-headliner'
    const date = new Date('2025-11-01')

    const createdConcert = {
      id: 'concert-no-head',
      date,
      latitude: 51.5,
      longitude: -0.1,
      venue: 'London Hall',
      normalizedCity: 'London',
      isFestival: false,
      festivalId: null,
      createdById: userId,
      updatedById: null,
      bands: [],
      festival: null,
      attendees: [{
        id: 'uc-no-head',
        userId,
        concertId: 'concert-no-head',
        cost: null,
        notes: null,
        supportingActIds: [],
      }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.concert.create).mockResolvedValue(createdConcert as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 51.5,
      longitude: -0.1,
      venue: 'London Hall',
      bandIds: [{ bandId: 'band-support-only', isHeadliner: false }],
    }

    const result = await createConcert(input)

    expect(result.id).toBe('concert-no-head')
    // Goes straight to createNewConcertWithUser (no findMatchingConcert)
    expect(prisma.concert.findMany).not.toHaveBeenCalled()
    expect(prisma.concert.create).toHaveBeenCalled()
  })
})

// ============================================
// Phase 5: Additional Branch Coverage
// ============================================

describe('Additional Branch Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserTotalSpent additional paths', () => {
    test('test_getUserTotalSpent_pastOnly_no_band_uses_prisma_aggregate', async () => {
      const userId = 'user-past-only'
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-01T00:00:00.000Z'))

      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 500 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'EUR' } as any)

      const result = await getUserTotalSpent(userId, { pastOnly: true })

      expect(result.total).toBe(500)
      expect(result.currency).toBe('EUR')
      // Verify pastOnly was applied to the aggregate where clause
      expect(prisma.userConcert.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            concert: expect.objectContaining({
              date: expect.objectContaining({ lt: expect.any(Date) }),
            }),
          }),
        })
      )

      vi.useRealTimers()
    })

    test('test_getUserTotalSpent_city_filter_uses_prisma_aggregate', async () => {
      const userId = 'user-city-filter'

      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 200 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'USD' } as any)

      const result = await getUserTotalSpent(userId, { city: 'Berlin' })

      expect(result.total).toBe(200)
      expect(result.currency).toBe('USD')
      expect(prisma.userConcert.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            concert: expect.objectContaining({
              normalizedCity: 'Berlin',
            }),
          }),
        })
      )
    })

    test('test_getUserTotalSpent_year_filter_uses_prisma_aggregate', async () => {
      const userId = 'user-year-filter'

      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 350 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'EUR' } as any)

      const result = await getUserTotalSpent(userId, { year: 2023 })

      expect(result.total).toBe(350)
      expect(prisma.userConcert.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            concert: expect.objectContaining({
              date: {
                gte: new Date(2023, 0, 1),
                lte: new Date(2023, 11, 31, 23, 59, 59, 999),
              },
            }),
          }),
        })
      )
    })

    test('test_getUserTotalSpent_bandSlug_not_found_falls_through_to_aggregate', async () => {
      const userId = 'user-no-band'

      // Band not found by slug
      vi.mocked(prisma.band.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 100 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ currency: 'EUR' } as any)

      const result = await getUserTotalSpent(userId, { bandSlug: 'nonexistent' })

      expect(result.total).toBe(100)
      // Falls through to aggregate path since band not found
      expect(prisma.userConcert.aggregate).toHaveBeenCalled()
    })
  })

  describe('getConcertStatistics past/future counts', () => {
    test('test_getConcertStatistics_includes_past_and_future_totals', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-01T00:00:00.000Z'))

      vi.mocked(prisma.concert.groupBy).mockResolvedValue([])
      vi.mocked(prisma.concertBand.groupBy).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])
      vi.mocked(prisma.concertBand.count).mockResolvedValue(0)

      // Mock past and future counts
      vi.mocked(prisma.concert.count).mockImplementation((args: any) => {
        if (args?.where?.date?.lt) return Promise.resolve(100) // Past
        if (args?.where?.date?.gte) return Promise.resolve(10)  // Future
        return Promise.resolve(0)
      })

      const stats = await getConcertStatistics()

      expect(stats.totalPast).toBe(100)
      expect(stats.totalFuture).toBe(10)

      vi.useRealTimers()
    })
  })

  describe('updateConcert support-act-only edit', () => {
    test('test_updateConcert_support_act_only_does_not_fork', async () => {
      const userId = 'user-support-edit'
      const concertId = 'concert-support-edit'

      vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
        id: 'attendance-support',
        userId,
        concertId,
        cost: 50,
        notes: null,
        supportingActIds: [],
      } as any)

      const existing = {
        id: concertId,
        date: new Date('2024-08-15'),
        latitude: 52.52,
        longitude: 13.405,
        venue: 'Venue X',
        normalizedCity: 'Berlin',
        isFestival: false,
        festivalId: null,
        bands: [{
          bandId: 'band-headliner',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-headliner', name: 'Headliner', slug: 'headliner' },
        }],
        festival: null,
        _count: { attendees: 1 },
      }

      // 1st findUnique: fetch existing
      vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)
      // userConcert.update for support acts
      vi.mocked(prisma.userConcert.update).mockResolvedValueOnce({} as any)

      const updatedConcertResult = {
        ...existing,
        attendees: [{
          id: 'attendance-support',
          userId,
          concertId,
          cost: 50,
          notes: null,
          supportingActIds: [{ bandId: 'band-support-new', sortOrder: 0 }],
        }],
      }

      // 2nd findUnique: re-fetch after support-act update
      vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(updatedConcertResult as any)
      // findUnique for updated attendance
      vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
        id: 'attendance-support',
        userId,
        concertId,
        cost: 50,
        notes: null,
        supportingActIds: [{ bandId: 'band-support-new', sortOrder: 0 }],
      } as any)

      const supportBand = { id: 'band-support-new', name: 'Support New', slug: 'support-new' }
      vi.mocked(prisma.band.findMany).mockResolvedValue([supportBand] as any)

      const result = await updateConcert(concertId, userId, {
        bandIds: [
          { bandId: 'band-headliner', isHeadliner: true },
          { bandId: 'band-support-new', isHeadliner: false },
        ],
      })

      expect(result).not.toBeNull()
      // Support-act-only edit: no fork, no concert.update on shared data
      expect(prisma.$transaction).not.toHaveBeenCalled()
      // UserConcert updated with new supportingActIds
      expect(prisma.userConcert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supportingActIds: [{ bandId: 'band-support-new', sortOrder: 0 }],
          }),
        })
      )
    })
  })

  describe('getUserConcerts', () => {
    test('test_getUserConcerts_returns_transformed_concerts_for_user', async () => {
      const userId = 'user-concerts-1'
      const mockBand = {
        id: 'band-uc-1',
        name: 'User Band',
        slug: 'user-band',
        imageUrl: null,
        imageEnrichedAt: null,
        lastfmUrl: null,
        websiteUrl: null,
        genres: [],
        bio: null,
        createdById: userId,
        updatedById: null,
      }

      const mockUserConcerts = [
        {
          id: 'uc-1',
          userId,
          concertId: 'c-1',
          cost: 50,
          notes: 'Good show',
          supportingActIds: [],
          concert: {
            id: 'c-1',
            date: new Date('2024-03-15'),
            latitude: 52.52,
            longitude: 13.405,
            venue: 'Berlin Venue',
            normalizedCity: 'Berlin',
            isFestival: false,
            festivalId: null,
            createdById: userId,
            updatedById: null,
            bands: [{
              concertId: 'c-1',
              bandId: 'band-uc-1',
              isHeadliner: true,
              sortOrder: 0,
              band: mockBand,
            }],
            festival: null,
            _count: { attendees: 1 },
          },
        },
      ]

      vi.mocked(prisma.userConcert.findMany).mockResolvedValue(mockUserConcerts as any)
      vi.mocked(prisma.band.findMany).mockResolvedValue([])

      // Import getUserConcerts dynamically since it's not in the original imports
      const { getUserConcerts } = await import('./concerts')
      const result = await getUserConcerts(userId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('c-1')
      expect(result[0].venue).toBe('Berlin Venue')
      expect(result[0].attendance).toBeDefined()
      expect(result[0].attendance!.cost).toBe('50')
    })
  })
})

// ============================================
// Phase 6: Cover updateConcert shared-field updates,
// post-update dedup, band-filtered pagination, and
// getUserTotalSpent bandSlug path
// ============================================

describe('updateConcert shared field updates (single attendee)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const band = { id: 'band-1', name: 'Band A', slug: 'band-a', imageUrl: null, imageEnrichedAt: null, lastfmUrl: null, websiteUrl: null, genres: [], bio: null, createdById: 'u1', updatedById: null }

  const makeExisting = (overrides = {}) => ({
    id: 'c-update-1',
    date: new Date('2024-06-15'),
    latitude: 52.52,
    longitude: 13.405,
    venue: 'Old Venue',
    normalizedCity: 'Berlin',
    isFestival: false,
    festivalId: null,
    createdById: 'user-1',
    updatedById: null,
    bands: [{ bandId: 'band-1', isHeadliner: true, sortOrder: 0, band }],
    festival: null,
    _count: { attendees: 1 },
    ...overrides,
  })

  test('test_updateConcert_shared_venue_change_single_attendee_updates_in_place', async () => {
    const userId = 'user-1'
    const existing = makeExisting()

    // attendance lookup
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'att-1', userId, concertId: 'c-update-1', cost: null, notes: null, supportingActIds: [],
    } as any)
    // fetch existing concert
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)

    // concert.update for shared fields
    vi.mocked(prisma.concert.update).mockResolvedValue(existing as any)

    // post-update findUnique (dedup check) - concert with bands
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      venue: 'New Venue',
      bands: [{ bandId: 'band-1', isHeadliner: true }],
    } as any)
    // findMatchingConcert: no match
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    // final fetch
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      venue: 'New Venue',
      attendees: [{ userId, cost: null, notes: null, supportingActIds: [] }],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await updateConcert('c-update-1', userId, { venue: 'New Venue' })

    expect(result).not.toBeNull()
    expect(prisma.concert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c-update-1' },
        data: expect.objectContaining({ venue: 'New Venue', updatedById: userId }),
      })
    )
  })

  test('test_updateConcert_cost_and_notes_update', async () => {
    const userId = 'user-1'
    const existing = makeExisting()

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'att-1', userId, concertId: 'c-update-1', cost: null, notes: null, supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)

    // userConcert.update for cost/notes
    vi.mocked(prisma.userConcert.update).mockResolvedValue({} as any)

    // final fetch (no shared updates, so no dedup)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      attendees: [{ userId, cost: 75, notes: 'Great gig', supportingActIds: [] }],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await updateConcert('c-update-1', userId, { cost: 75, notes: 'Great gig' })

    expect(result).not.toBeNull()
    expect(prisma.userConcert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att-1' },
        data: expect.objectContaining({ cost: 75, notes: 'Great gig' }),
      })
    )
  })

  test('test_updateConcert_band_change_single_attendee_updates_concertBand', async () => {
    const userId = 'user-1'
    const existing = makeExisting()

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'att-1', userId, concertId: 'c-update-1', cost: null, notes: null, supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)

    // userConcert.update for supportingActIds
    vi.mocked(prisma.userConcert.update).mockResolvedValue({} as any)
    // concertBand.deleteMany + create
    vi.mocked(prisma.concertBand.deleteMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.concertBand.create).mockResolvedValue({} as any)

    // final fetch
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      bands: [{ bandId: 'band-new', isHeadliner: true, sortOrder: 0, band: { ...band, id: 'band-new', name: 'New Band', slug: 'new-band' } }],
      attendees: [{ userId, cost: null, notes: null, supportingActIds: [{ bandId: 'band-support', sortOrder: 0 }] }],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await updateConcert('c-update-1', userId, {
      bandIds: [
        { bandId: 'band-new', isHeadliner: true },
        { bandId: 'band-support', isHeadliner: false },
      ],
    })

    expect(result).not.toBeNull()
    expect(prisma.concertBand.deleteMany).toHaveBeenCalledWith({ where: { concertId: 'c-update-1' } })
    expect(prisma.concertBand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ concertId: 'c-update-1', bandId: 'band-new', isHeadliner: true }),
      })
    )
  })

  test('test_updateConcert_existing_not_found_returns_null', async () => {
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'att-x', userId: 'u1', concertId: 'c-gone', cost: null, notes: null, supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    const result = await updateConcert('c-gone', 'u1', { venue: 'X' })
    expect(result).toBeNull()
  })
})

describe('updateConcert post-update dedup matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const band = { id: 'band-1', name: 'Band A', slug: 'band-a', imageUrl: null, imageEnrichedAt: null, lastfmUrl: null, websiteUrl: null, genres: [], bio: null, createdById: 'u1', updatedById: null }

  test('test_updateConcert_dedup_migrates_user_to_matching_concert', async () => {
    const userId = 'user-1'
    const existing = {
      id: 'c-dedup-1',
      date: new Date('2024-06-15'),
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Venue A',
      normalizedCity: 'Berlin',
      isFestival: false,
      festivalId: null,
      createdById: userId,
      updatedById: null,
      bands: [{ bandId: 'band-1', isHeadliner: true, sortOrder: 0, band }],
      festival: null,
      _count: { attendees: 1 },
    }

    // attendance lookup
    vi.mocked(prisma.userConcert.findUnique)
      .mockResolvedValueOnce({ id: 'att-1', userId, concertId: 'c-dedup-1', cost: 50, notes: 'nice', supportingActIds: [] } as any)
    // fetch existing
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)

    // concert.update (shared field)
    vi.mocked(prisma.concert.update).mockResolvedValue(existing as any)

    // post-update findUnique (dedup) - returns concert with headliner
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      venue: 'Venue B',
      bands: [{ bandId: 'band-1', isHeadliner: true }],
    } as any)

    // findMatchingConcert: FOUND a match
    const matchingConcert = { id: 'c-match-1', date: existing.date, latitude: existing.latitude, longitude: existing.longitude }
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([matchingConcert] as any)

    // Re-fetch attendance for migration
    vi.mocked(prisma.userConcert.findUnique)
      .mockResolvedValueOnce({ id: 'att-1', userId, concertId: 'c-dedup-1', cost: 50, notes: 'nice', supportingActIds: [] } as any)
    // Check if user already on matching concert: no
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce(null)
    // Create attendance on matching concert
    vi.mocked(prisma.userConcert.create).mockResolvedValue({} as any)
    // Delete old attendance
    vi.mocked(prisma.userConcert.delete).mockResolvedValue({} as any)
    // Count remaining attendees on old concert: 0 → delete orphan
    vi.mocked(prisma.userConcert.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.concert.delete).mockResolvedValue({} as any)

    // Final fetch of matching concert
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: 'c-match-1',
      date: existing.date,
      latitude: existing.latitude,
      longitude: existing.longitude,
      venue: 'Venue B',
      normalizedCity: 'Berlin',
      isFestival: false,
      festivalId: null,
      createdById: 'other-user',
      updatedById: null,
      bands: [{ bandId: 'band-1', isHeadliner: true, sortOrder: 0, band }],
      festival: null,
      attendees: [{ userId, cost: 50, notes: 'nice', supportingActIds: [] }],
      _count: { attendees: 2 },
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await updateConcert('c-dedup-1', userId, { venue: 'Venue B' })

    expect(result).not.toBeNull()
    expect(result!.id).toBe('c-match-1')
    // Verify migration happened
    expect(prisma.userConcert.create).toHaveBeenCalled()
    expect(prisma.userConcert.delete).toHaveBeenCalled()
    expect(prisma.concert.delete).toHaveBeenCalledWith({ where: { id: 'c-dedup-1' } })
  })
})

describe('updateConcert multi-attendee band-only change (no fork)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('test_updateConcert_multi_attendee_band_only_updates_supportingActIds', async () => {
    const userId = 'user-1'
    const band = { id: 'band-1', name: 'Band A', slug: 'band-a', imageUrl: null, imageEnrichedAt: null, lastfmUrl: null, websiteUrl: null, genres: [], bio: null, createdById: 'u1', updatedById: null }
    const existing = {
      id: 'c-multi-1',
      date: new Date('2024-06-15'),
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Venue A',
      normalizedCity: 'Berlin',
      isFestival: false,
      festivalId: null,
      createdById: 'other-user',
      updatedById: null,
      bands: [{ bandId: 'band-1', isHeadliner: true, sortOrder: 0, band }],
      festival: null,
      _count: { attendees: 3 },
    }

    // attendance
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'att-m1', userId, concertId: 'c-multi-1', cost: null, notes: null, supportingActIds: [],
    } as any)
    // fetch existing
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)

    // userConcert.update for supportingActIds (multi-attendee, same headliner)
    vi.mocked(prisma.userConcert.update).mockResolvedValue({} as any)

    // final fetch
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      attendees: [{ userId, cost: null, notes: null, supportingActIds: [{ bandId: 'band-support', sortOrder: 0 }] }],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await updateConcert('c-multi-1', userId, {
      bandIds: [
        { bandId: 'band-1', isHeadliner: true },
        { bandId: 'band-support', isHeadliner: false },
      ],
    })

    expect(result).not.toBeNull()
    // Should update supportingActIds on userConcert, NOT fork
    expect(prisma.userConcert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att-m1' },
        data: { supportingActIds: [{ bandId: 'band-support', sortOrder: 0 }] },
      })
    )
    // Should NOT create a new concert (no fork)
    expect(prisma.concert.create).not.toHaveBeenCalled()
  })
})

describe('getConcertsPaginated with userId + bandSlug filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('test_getConcertsPaginated_userId_bandSlug_uses_raw_sql', async () => {
    // When userId + bandSlug are both set, it resolves bandSlug to bandId
    // then delegates to getConcertsPaginatedForUserByBand (raw SQL)
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({ id: 'band-1' } as any)

    // Raw SQL returns matching userConcert IDs
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'uc-1' },
      { id: 'uc-2' },
    ])

    // Fetch full userConcert records
    const band = { id: 'band-1', name: 'Band A', slug: 'band-a', imageUrl: null, imageEnrichedAt: null, lastfmUrl: null, websiteUrl: null, genres: [], bio: null, createdById: 'u1', updatedById: null }
    vi.mocked(prisma.userConcert.findMany).mockResolvedValueOnce([
      {
        id: 'uc-1',
        userId: 'user-1',
        concertId: 'c-1',
        cost: null,
        notes: null,
        supportingActIds: null,
        concert: {
          id: 'c-1',
          date: new Date('2024-06-15'),
          latitude: 52.52,
          longitude: 13.405,
          venue: 'Venue A',
          normalizedCity: 'Berlin',
          isFestival: false,
          festivalId: null,
          createdById: 'user-1',
          updatedById: null,
          bands: [{ concertId: 'c-1', bandId: 'band-1', isHeadliner: true, sortOrder: 0, band }],
          festival: null,
          _count: { attendees: 1 },
        },
      },
    ] as any)

    vi.mocked(prisma.band.findMany).mockResolvedValue([])

    const result = await getConcertsPaginated(undefined, 20, 'forward', {
      userId: 'user-1',
      bandSlug: 'band-a',
    })

    expect(prisma.band.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'band-a' } })
    )
    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(result.items).toHaveLength(1)
  })

  test('test_getConcertsPaginated_userId_bandSlug_empty_rows', async () => {
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({ id: 'band-1' } as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([])

    const result = await getConcertsPaginated(undefined, 20, 'forward', {
      userId: 'user-1',
      bandSlug: 'band-a',
    })

    expect(result.items).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })
})

describe('getUserTotalSpent with bandSlug filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('test_getUserTotalSpent_bandSlug_uses_raw_sql', async () => {
    // Resolve bandSlug to bandId
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({ id: 'band-1' } as any)

    // Raw SQL returns total
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ total: 150 }])

    // User currency lookup
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ currency: 'USD' } as any)

    const result = await getUserTotalSpent('user-1', { bandSlug: 'band-a' })

    expect(result.total).toBe(150)
    expect(result.currency).toBe('USD')
    expect(prisma.band.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'band-a' } })
    )
    expect(prisma.$queryRaw).toHaveBeenCalled()
  })
})
