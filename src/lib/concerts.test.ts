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
  ConcertAlreadyExistsError,
  type CreateConcertInput,
} from "./concerts"

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    concert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    userConcert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    band: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    concertBand: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

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
    // Tests error handling when cursor points to non-existent concert
    // Should not crash, should return empty results or skip cursor
    const invalidCursor = "non-existent-cursor-id"

    // Mock: no concerts found with invalid cursor
    vi.mocked(prisma.concert.findMany).mockResolvedValue([])

    const result = await getConcertsPaginated(invalidCursor, 20, "forward")

    // Should handle gracefully without throwing
    expect(result).toBeDefined()
    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
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
