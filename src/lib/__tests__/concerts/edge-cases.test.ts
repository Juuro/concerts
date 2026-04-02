/**
 * Edge-case unit tests extracted from `src/lib/concerts.test.ts`.
 *
 * Test data uses anonymized PII following GDPR compliance.
 * (Shared repository contract: keep synthetic identifiers non-sensitive.)
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { createConcert } from "@/lib/concerts/mutations/create"
import { updateConcert } from "@/lib/concerts/mutations/update"
import { deleteConcert } from "@/lib/concerts/mutations/delete"
import { getConcertsPaginated } from "@/lib/concerts/pagination"
import { findMatchingConcert } from "@/lib/concerts/matching"
import { ConcertAlreadyExistsError } from "@/lib/concerts/errors"
import type { CreateConcertInput } from "@/lib/concerts/types"

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
    vi.mocked(prisma.concert.findMany).mockRejectedValue(new Error("Record to fetch does not exist."))

    // Expect the pagination helper to surface the underlying error
    await expect(getConcertsPaginated(invalidCursor, 20, "forward")).rejects.toThrow(
      "Record to fetch does not exist.",
    )
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

    const result = await findMatchingConcert(date, latitude, longitude, headlinerBandId)

    // Should return null when no match found
    expect(result).toBeNull()
  })

  test("test_findMatchingConcert_when_coords_within_0_001_deg_match_outside_tolerance_returns_null", async () => {
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
      headlinerBandId,
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
      }),
    )

    expect(matchAtBoundary).toBe(existingConcert)

    // Test 2: Outside tolerance (0.002 degrees) - SHOULD NOT match
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    const noMatchOutsideTolerance = await findMatchingConcert(
      date,
      baseLat + 0.002, // Outside tolerance
      baseLon + 0.002,
      headlinerBandId,
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

