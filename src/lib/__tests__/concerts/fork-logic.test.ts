/**
 * Fork Logic (Multi-Tenant) unit tests extracted from `src/lib/concerts.test.ts`.
 *
 * Notes:
 * - These tests intentionally keep Prisma mock shapes minimal (`as any`) to reduce
 *   duplication while still exercising the fork decision + transaction behavior.
 * - They mock `getGeocodingData` so forked concerts get deterministic `normalizedCity`.
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { updateConcert } from "@/lib/concerts/mutations/update"

// Mock external utilities
vi.mock("@/utils/data", () => ({
  getGeocodingData: vi.fn().mockResolvedValue({
    _normalized_city: "Test City",
    _is_coordinates: false,
  }),
}))

function mkBand(params: {
  id: string
  name: string
  slug: string
}): any {
  return {
    id: params.id,
    name: params.name,
    slug: params.slug,
    url: `/band/${params.slug}/`,
    imageUrl: null,
    imageEnrichedAt: null,
    lastfmUrl: null,
    websiteUrl: null,
    genres: [],
    bio: null,
    createdById: "user-test",
    updatedById: null,
  }
}

describe("Fork Logic (Multi-Tenant)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_updateConcert_when_multi_attendee_and_date_change_forks_new_concert", async () => {
    const userId = "user-1"
    const originalDate = new Date("2024-06-15")
    const newDate = new Date("2024-06-16")

    const headlinerBand = mkBand({ id: "band-1", name: "Band A", slug: "band-a" })

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "attendance-1",
      userId,
      concertId: "concert-1",
      cost: 50,
      notes: "Great show",
      supportingActIds: [],
    } as any)

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "concert-1",
      date: originalDate,
      latitude: 52.52,
      longitude: 13.405,
      venue: "Venue A",
      normalizedCity: "berlin",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-1",
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      _count: { attendees: 2 },
    } as any)

    // Merge-after-fork should not happen in this test.
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    const forkedConcert = {
      id: "concert-2",
      date: newDate,
      latitude: 52.52,
      longitude: 13.405,
      venue: "Venue A",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-1",
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      attendees: [
        {
          id: "attendance-fork-1",
          userId,
          concertId: "concert-2",
          cost: 50,
          notes: "Great show",
          supportingActIds: [],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)

    const result = await updateConcert("concert-1", userId, { date: newDate })

    expect(result).toBeTruthy()
    expect(result?.id).toBe("concert-2")
    expect(result?.date).toBe(newDate.toISOString())

    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: { userId_concertId: { userId, concertId: "concert-1" } },
    })
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date: newDate,
          createdById: userId,
        }),
      }),
    )
  })

  test("test_updateConcert_when_multi_attendee_and_venue_change_forks_new_concert", async () => {
    const userId = "user-2"

    const headlinerBand = mkBand({ id: "band-2", name: "Band B", slug: "band-b" })

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "attendance-2",
      userId,
      concertId: "concert-3",
      cost: 60,
      notes: null,
      supportingActIds: [],
    } as any)

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "concert-3",
      date: new Date("2024-07-20"),
      latitude: 51.5,
      longitude: -0.1,
      venue: "Old Venue",
      normalizedCity: "london",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-2",
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      _count: { attendees: 3 },
    } as any)

    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    const forkedConcert = {
      id: "concert-4",
      date: new Date("2024-07-20"),
      latitude: 51.5,
      longitude: -0.1,
      venue: "New Venue",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-2",
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      attendees: [
        {
          id: "attendance-fork-2",
          userId,
          concertId: "concert-4",
          cost: 60,
          notes: null,
          supportingActIds: [],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)

    const result = await updateConcert("concert-3", userId, { venue: "New Venue" })

    expect(result).toBeTruthy()
    expect(result?.venue).toBe("New Venue")
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test("test_updateConcert_when_multi_attendee_and_headliner_change_forks_new_concert", async () => {
    const userId = "user-3"

    const existingHeadlinerBand = mkBand({ id: "band-3", name: "Band C", slug: "band-c" })
    const newHeadlinerBand = mkBand({ id: "band-4", name: "Band D", slug: "band-d" })

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "attendance-3",
      userId,
      concertId: "concert-5",
      cost: 75,
      notes: "Amazing",
      supportingActIds: [],
    } as any)

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "concert-5",
      date: new Date("2024-08-10"),
      latitude: 48.8566,
      longitude: 2.3522,
      venue: "Paris Arena",
      normalizedCity: "paris",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-3",
          isHeadliner: true,
          sortOrder: 0,
          band: existingHeadlinerBand,
        },
      ],
      _count: { attendees: 2 },
    } as any)

    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    const forkedConcert = {
      id: "concert-6",
      date: new Date("2024-08-10"),
      latitude: 48.8566,
      longitude: 2.3522,
      venue: "Paris Arena",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-4",
          isHeadliner: true,
          sortOrder: 0,
          band: newHeadlinerBand,
        },
      ],
      attendees: [
        {
          id: "attendance-fork-3",
          userId,
          concertId: "concert-6",
          cost: 75,
          notes: "Amazing",
          supportingActIds: [],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)

    const result = await updateConcert("concert-5", userId, {
      bandIds: [{ bandId: "band-4", isHeadliner: true }],
    })

    expect(result).toBeTruthy()
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bands: expect.objectContaining({
            create: expect.objectContaining({
              bandId: "band-4",
              isHeadliner: true,
            }),
          }),
        }),
      }),
    )
  })

  test("test_updateConcert_when_fork_creates_new_concert_and_removes_user_from_original", async () => {
    const userId = "user-fork-1"

    const headlinerBand = mkBand({ id: "band-fork", name: "Fork Band", slug: "fork-band" })

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "attendance-fork-original",
      userId,
      concertId: "concert-original",
      cost: 100,
      notes: "Fork test",
      supportingActIds: [],
    } as any)

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "concert-original",
      date: new Date("2024-09-01"),
      latitude: 40.7128,
      longitude: -74.006,
      venue: "Original Venue",
      normalizedCity: "new-york",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-fork",
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      _count: { attendees: 2 },
    } as any)

    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    const forkedConcert = {
      id: "concert-forked",
      date: new Date("2024-09-02"),
      latitude: 40.7128,
      longitude: -74.006,
      venue: "Original Venue",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-fork",
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      attendees: [
        {
          id: "attendance-forked-1",
          userId,
          concertId: "concert-forked",
          cost: 100,
          notes: "Fork test",
          supportingActIds: [],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)

    await updateConcert("concert-original", userId, {
      date: new Date("2024-09-02"),
    })

    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: { userId_concertId: { userId, concertId: "concert-original" } },
    })
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendees: expect.any(Object),
        }),
      }),
    )
  })

  test("test_updateConcert_when_fork_preserves_user_cost_and_notes", async () => {
    const userId = "user-preserve"
    const userCost = 150
    const userNotes = "VIP ticket with backstage pass"

    const headlinerBand = mkBand({
      id: "band-preserve",
      name: "Preserve Band",
      slug: "preserve-band",
    })
    const supportingBand = mkBand({
      id: "support-1",
      name: "Support Band",
      slug: "support-band",
    })

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "attendance-preserve",
      userId,
      concertId: "concert-preserve",
      cost: userCost,
      notes: userNotes,
      supportingActIds: [{ bandId: supportingBand.id, sortOrder: 0 }],
    } as any)

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "concert-preserve",
      date: new Date("2024-10-15"),
      latitude: 34.0522,
      longitude: -118.2437,
      venue: "LA Venue",
      normalizedCity: "los-angeles",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: headlinerBand.id,
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      _count: { attendees: 2 },
    } as any)

    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.band.findMany).mockResolvedValueOnce([supportingBand as any])

    const forkedConcert = {
      id: "concert-forked-preserve",
      date: new Date("2024-10-16"),
      latitude: 34.0522,
      longitude: -118.2437,
      venue: "LA Venue",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: headlinerBand.id,
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      attendees: [
        {
          id: "attendance-forked-preserve",
          userId,
          concertId: "concert-forked-preserve",
          cost: userCost,
          notes: userNotes,
          supportingActIds: [{ bandId: supportingBand.id, sortOrder: 0 }],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)

    await updateConcert("concert-preserve", userId, {
      date: new Date("2024-10-16"),
    })

    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendees: expect.objectContaining({
            create: expect.objectContaining({
              userId,
              cost: userCost,
              notes: userNotes,
              supportingActIds: [{ bandId: supportingBand.id, sortOrder: 0 }],
            }),
          }),
        }),
      }),
    )
  })

  test("test_updateConcert_when_fork_with_remaining_attendees_preserves_original_concert", async () => {
    const userId = "user-keep-original"

    const headlinerBand = mkBand({ id: "band-keep", name: "Keep Band", slug: "keep-band" })

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "attendance-keep",
      userId,
      concertId: "concert-keep",
      cost: 80,
      notes: null,
      supportingActIds: [],
    } as any)

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "concert-keep",
      date: new Date("2024-11-20"),
      latitude: 51.5074,
      longitude: -0.1278,
      venue: "London Venue",
      normalizedCity: "london",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: headlinerBand.id,
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      _count: { attendees: 3 },
    } as any)

    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    const forkedConcert = {
      id: "concert-forked-keep",
      date: new Date("2024-11-21"),
      latitude: 51.5074,
      longitude: -0.1278,
      venue: "London Venue",
      normalizedCity: "Test City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: headlinerBand.id,
          isHeadliner: true,
          sortOrder: 0,
          band: headlinerBand,
        },
      ],
      attendees: [
        {
          id: "attendance-forked-keep",
          userId,
          concertId: "concert-forked-keep",
          cost: 80,
          notes: null,
          supportingActIds: [],
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)

    await updateConcert("concert-keep", userId, {
      date: new Date("2024-11-21"),
    })

    // `forkConcertForUser` unlinks only the editing user. It does not delete the
    // original concert when it becomes orphaned (that behavior would require
    // additional count checks, which are not part of the fork flow).
    expect(prisma.concert.delete).not.toHaveBeenCalled()
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: { userId_concertId: { userId, concertId: "concert-keep" } },
    })
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test("test_updateConcert_when_single_attendee_core_field_change_updates_in_place", async () => {
    const userId = "user-single"
    const existingDate = new Date("2024-12-01")
    const updatedDate = new Date("2024-12-02")

    const headlinerBand = mkBand({ id: "band-single", name: "Single Band", slug: "single-band" })

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "attendance-single",
      userId,
      concertId: "concert-single",
      cost: 45,
      notes: "Solo show",
      supportingActIds: [],
    } as any)

    // 1) Fetch existing concert (for fork decision)
    vi.mocked(prisma.concert.findUnique)
      .mockResolvedValueOnce({
        id: "concert-single",
        date: existingDate,
        latitude: 52.52,
        longitude: 13.405,
        venue: "Single Venue",
        normalizedCity: "berlin",
        isFestival: false,
        festivalId: null,
        festival: null,
        bands: [
          {
            bandId: headlinerBand.id,
            isHeadliner: true,
            sortOrder: 0,
            band: headlinerBand,
          },
        ],
        _count: { attendees: 1 },
      } as any)

    // concert.update
    vi.mocked(prisma.concert.update).mockResolvedValueOnce({
      id: "concert-single",
    } as any)

    // 2) Re-fetch after update (for matching concert check)
    vi.mocked(prisma.concert.findUnique)
      .mockResolvedValueOnce({
        id: "concert-single",
        date: updatedDate,
        latitude: 52.52,
        longitude: 13.405,
        bands: [{ bandId: headlinerBand.id, isHeadliner: true }],
      } as any)

    // findMatchingConcert: no match
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])

    // 3) Final fetch with relations (for transformConcert)
    vi.mocked(prisma.concert.findUnique)
      .mockResolvedValueOnce({
        id: "concert-single",
        date: updatedDate,
        latitude: 52.52,
        longitude: 13.405,
        venue: "Single Venue",
        normalizedCity: "berlin",
        isFestival: false,
        festivalId: null,
        festival: null,
        bands: [
          {
            bandId: headlinerBand.id,
            isHeadliner: true,
            sortOrder: 0,
            band: headlinerBand,
          },
        ],
        attendees: [
          {
            id: "attendance-single",
            userId,
            concertId: "concert-single",
            cost: 45,
            notes: "Solo show",
            supportingActIds: [],
          },
        ],
        _count: { attendees: 1 },
      } as any)

    const result = await updateConcert("concert-single", userId, {
      date: updatedDate,
    })

    expect(result).toBeTruthy()
    expect(result?.id).toBe("concert-single")
    expect(result?.date).toBe(updatedDate.toISOString())

    // Verify update called (not fork)
    expect(prisma.concert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "concert-single" },
      }),
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe("updateConcert multi-attendee band-only change (no fork)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_updateConcert_multi_attendee_band_only_updates_supportingActIds", async () => {
    const userId = "user-1"
    const band = {
      id: "band-1",
      name: "Band A",
      slug: "band-a",
      imageUrl: null,
      imageEnrichedAt: null,
      lastfmUrl: null,
      websiteUrl: null,
      genres: [],
      bio: null,
      createdById: "u1",
      updatedById: null,
    }
    const existing = {
      id: "c-multi-1",
      date: new Date("2024-06-15"),
      latitude: 52.52,
      longitude: 13.405,
      venue: "Venue A",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      createdById: "other-user",
      updatedById: null,
      bands: [{ bandId: "band-1", isHeadliner: true, sortOrder: 0, band }],
      festival: null,
      _count: { attendees: 3 },
    }
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-m1",
      userId,
      concertId: "c-multi-1",
      cost: null,
      notes: null,
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)
    vi.mocked(prisma.userConcert.update).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      attendees: [{ userId, cost: null, notes: null, supportingActIds: [{ bandId: "band-support", sortOrder: 0 }] }],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])
    const result = await updateConcert("c-multi-1", userId, {
      bandIds: [
        { bandId: "band-1", isHeadliner: true },
        { bandId: "band-support", isHeadliner: false },
      ],
    })
    expect(result).not.toBeNull()
    expect(prisma.userConcert.update).toHaveBeenCalled()
    expect(prisma.concert.create).not.toHaveBeenCalled()
  })
})

describe("updateConcert post-update dedup matching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_updateConcert_dedup_migrates_user_to_matching_concert", async () => {
    const userId = "user-1"
    const band = {
      id: "band-1",
      name: "Band A",
      slug: "band-a",
      imageUrl: null,
      imageEnrichedAt: null,
      lastfmUrl: null,
      websiteUrl: null,
      genres: [],
      bio: null,
      createdById: "u1",
      updatedById: null,
    }
    const existing = {
      id: "c-dedup-1",
      date: new Date("2024-06-15"),
      latitude: 52.52,
      longitude: 13.405,
      venue: "Venue A",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      createdById: userId,
      updatedById: null,
      bands: [{ bandId: "band-1", isHeadliner: true, sortOrder: 0, band }],
      festival: null,
      _count: { attendees: 1 },
    }
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-1",
      userId,
      concertId: "c-dedup-1",
      cost: 50,
      notes: "nice",
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)
    vi.mocked(prisma.concert.update).mockResolvedValue(existing as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      venue: "Venue B",
      bands: [{ bandId: "band-1", isHeadliner: true }],
    } as any)
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([{ id: "c-match-1" }] as any)
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({ id: "att-1", userId } as any)
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.userConcert.create).mockResolvedValue({} as any)
    vi.mocked(prisma.userConcert.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.userConcert.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.concert.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "c-match-1",
      date: existing.date,
      latitude: existing.latitude,
      longitude: existing.longitude,
      venue: "Venue B",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      createdById: "other-user",
      updatedById: null,
      bands: [{ bandId: "band-1", isHeadliner: true, sortOrder: 0, band }],
      festival: null,
      attendees: [{ userId, cost: 50, notes: "nice", supportingActIds: [] }],
      _count: { attendees: 2 },
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])
    const result = await updateConcert("c-dedup-1", userId, { venue: "Venue B" })
    expect(result).not.toBeNull()
    expect(result!.id).toBe("c-match-1")
    expect(prisma.userConcert.create).toHaveBeenCalled()
    expect(prisma.userConcert.delete).toHaveBeenCalled()
  })
})

describe("updateConcert shared field updates (single attendee)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_updateConcert_shared_venue_change_single_attendee_updates_in_place", async () => {
    const userId = "user-1"
    const existing = {
      id: "c-update-1",
      date: new Date("2024-06-15"),
      latitude: 52.52,
      longitude: 13.405,
      venue: "Old Venue",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      createdById: "user-1",
      updatedById: null,
      bands: [{ bandId: "band-1", isHeadliner: true, sortOrder: 0, band: mkBand({ id: "band-1", name: "Band A", slug: "band-a" }) }],
      festival: null,
      _count: { attendees: 1 },
    }
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-1",
      userId,
      concertId: "c-update-1",
      cost: null,
      notes: null,
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)
    vi.mocked(prisma.concert.update).mockResolvedValue(existing as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      venue: "New Venue",
      bands: [{ bandId: "band-1", isHeadliner: true }],
    } as any)
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      venue: "New Venue",
      attendees: [{ userId, cost: null, notes: null, supportingActIds: [] }],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValue([])
    const result = await updateConcert("c-update-1", userId, { venue: "New Venue" })
    expect(result).not.toBeNull()
    expect(prisma.concert.update).toHaveBeenCalled()
  })
})

