/**
 * Phase 4: createConcert Happy Paths tests extracted from `src/lib/concerts.test.ts`.
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { createConcert } from "@/lib/concerts/mutations/create"
import type { CreateConcertInput } from "@/lib/concerts/types"

// Mock external utilities
vi.mock("@/utils/data", () => ({
  getGeocodingData: vi.fn().mockResolvedValue({
    _normalized_city: "Test City",
    _is_coordinates: false,
  }),
}))

describe("createConcert Happy Paths", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_createConcert_no_match_creates_new_concert", async () => {
    const userId = "user-create-1"
    const bandId = "band-new-1"
    const date = new Date("2025-09-15")

    // findMatchingConcert returns no match
    vi.mocked(prisma.concert.findMany).mockResolvedValue([] as any)

    // createNewConcertWithUser: concert.create
    const createdConcert = {
      id: "concert-new-1",
      date,
      latitude: 48.8566,
      longitude: 2.3522,
      venue: "Paris Arena",
      normalizedCity: "Paris",
      isFestival: false,
      festivalId: null,
      createdById: userId,
      updatedById: null,
      bands: [
        {
          concertId: "concert-new-1",
          bandId,
          isHeadliner: true,
          sortOrder: 0,
          band: { id: bandId, name: "New Band", slug: "new-band" },
        },
      ],
      festival: null,
      attendees: [
        {
          id: "uc-new-1",
          userId,
          concertId: "concert-new-1",
          cost: 75,
          notes: null,
          supportingActIds: [],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.concert.create).mockResolvedValue(createdConcert as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([] as any)

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 48.8566,
      longitude: 2.3522,
      venue: "Paris Arena",
      cost: 75,
      bandIds: [{ bandId, isHeadliner: true }],
    }

    const result = await createConcert(input)

    expect(result.id).toBe("concert-new-1")
    expect(result.venue).toBe("Paris Arena")
    expect(result.bands[0].name).toBe("New Band")
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test("test_createConcert_match_found_links_user_to_existing", async () => {
    const userId = "user-link-1"
    const bandId = "band-existing-1"
    const concertId = "concert-existing-1"
    const date = new Date("2025-10-01")

    const existingConcert = {
      id: concertId,
      date,
      latitude: 52.52,
      longitude: 13.405,
      venue: "Berlin Arena",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      createdById: "other-user",
      updatedById: null,
    }

    const existingWithBands = {
      ...existingConcert,
      bands: [
        {
          concertId,
          bandId,
          isHeadliner: true,
          sortOrder: 0,
          band: { id: bandId, name: "Existing Band", slug: "existing-band" },
        },
      ],
      festival: null,
      _count: { attendees: 1 },
    }

    // findMatchingConcert returns existing concert
    vi.mocked(prisma.concert.findMany).mockResolvedValue([
      existingConcert,
    ] as any)
    // Fetch full concert
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(
      existingWithBands as any
    )
    // User does NOT already attend
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue(null)
    // Link user
    vi.mocked(prisma.userConcert.create).mockResolvedValue({
      id: "uc-link-1",
      userId,
      concertId,
      cost: 60,
      notes: null,
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([] as any)

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 52.52,
      longitude: 13.405,
      venue: "Berlin Arena",
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

  test("test_createConcert_match_found_maps_supporting_acts_with_incrementing_sort_order", async () => {
    const userId = "user-link-2"
    const headlinerBandId = "band-headliner-1"
    const supportBandIdA = "band-support-1"
    const supportBandIdB = "band-support-2"
    const concertId = "concert-existing-2"
    const date = new Date("2025-10-02")

    const existingConcert = {
      id: concertId,
      date,
      latitude: 40.7128,
      longitude: -74.006,
      venue: "NY Arena",
      normalizedCity: "New York",
      isFestival: false,
      festivalId: null,
      createdById: "other-user",
      updatedById: null,
    }

    const existingWithBands = {
      ...existingConcert,
      bands: [
        {
          concertId,
          bandId: headlinerBandId,
          isHeadliner: true,
          sortOrder: 0,
          band: {
            id: headlinerBandId,
            name: "Headliner Band",
            slug: "headliner-band",
          },
        },
      ],
      festival: null,
      _count: { attendees: 2 },
    }

    vi.mocked(prisma.concert.findMany).mockResolvedValue([existingConcert] as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValue(
      existingWithBands as any
    )
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.userConcert.create).mockResolvedValue({
      id: "uc-link-2",
      userId,
      concertId,
      cost: 45,
      notes: null,
      supportingActIds: [
        { bandId: supportBandIdA, sortOrder: 0 },
        { bandId: supportBandIdB, sortOrder: 1 },
      ],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([] as any)

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 40.7128,
      longitude: -74.006,
      venue: "NY Arena",
      cost: 45,
      bandIds: [
        { bandId: supportBandIdA, isHeadliner: false },
        { bandId: headlinerBandId, isHeadliner: true },
        { bandId: supportBandIdB, isHeadliner: false },
      ],
    }

    await createConcert(input)

    expect(prisma.userConcert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          concertId,
          supportingActIds: [
            { bandId: supportBandIdA, sortOrder: 0 },
            { bandId: supportBandIdB, sortOrder: 1 },
          ],
        }),
      })
    )
  })

  test("test_createConcert_no_headliner_creates_new_concert", async () => {
    const userId = "user-no-headliner"
    const date = new Date("2025-11-01")

    const createdConcert = {
      id: "concert-no-head",
      date,
      latitude: 51.5,
      longitude: -0.1,
      venue: "London Hall",
      normalizedCity: "London",
      isFestival: false,
      festivalId: null,
      createdById: userId,
      updatedById: null,
      bands: [],
      festival: null,
      attendees: [
        {
          id: "uc-no-head",
          userId,
          concertId: "concert-no-head",
          cost: null,
          notes: null,
          supportingActIds: [],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.concert.create).mockResolvedValue(createdConcert as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([] as any)

    const input: CreateConcertInput = {
      userId,
      date,
      latitude: 51.5,
      longitude: -0.1,
      venue: "London Hall",
      bandIds: [{ bandId: "band-support-only", isHeadliner: false }],
    }

    const result = await createConcert(input)

    expect(result.id).toBe("concert-no-head")
    // Goes straight to createNewConcertWithUser (no findMatchingConcert)
    expect(prisma.concert.findMany).not.toHaveBeenCalled()
    expect(prisma.concert.create).toHaveBeenCalled()
  })
})
