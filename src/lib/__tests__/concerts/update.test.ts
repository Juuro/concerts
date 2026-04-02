import { beforeEach, describe, expect, test, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { updateConcert } from "@/lib/concerts/mutations/update"

function mkBand(id: string, name: string, slug: string) {
  return {
    id,
    name,
    slug,
    imageUrl: null,
    imageEnrichedAt: null,
    lastfmUrl: null,
    websiteUrl: null,
    genres: [],
    bio: null,
    createdById: "u1",
    updatedById: null,
  }
}

describe("update.ts dedicated coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns null when attendance exists but concert no longer exists", async () => {
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-1",
      userId: "user-1",
      concertId: "c-1",
      cost: null,
      notes: null,
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    const result = await updateConcert("c-1", "user-1", { venue: "X" })
    expect(result).toBeNull()
  })

  test("fork path merges into matching concert and skips create when already attending match", async () => {
    const userId = "user-1"
    const headliner = mkBand("band-1", "Band 1", "band-1")
    const existing = {
      id: "c-source",
      date: new Date("2024-06-01T00:00:00.000Z"),
      latitude: 52.52,
      longitude: 13.4,
      venue: "Old Venue",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        { bandId: "band-1", isHeadliner: true, sortOrder: 0, band: headliner },
      ],
      _count: { attendees: 2 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-source",
      userId,
      concertId: "c-source",
      cost: 40,
      notes: "note",
      supportingActIds: [{ bandId: "band-s1", sortOrder: 0 }],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)

    const createdFork = {
      id: "c-fork",
      date: new Date("2024-06-02T00:00:00.000Z"),
      latitude: 52.52,
      longitude: 13.4,
      venue: "Old Venue",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        { bandId: "band-1", isHeadliner: true, sortOrder: 0, band: headliner },
      ],
      attendees: [
        {
          id: "att-fork",
          userId,
          concertId: "c-fork",
          cost: 40,
          notes: "note",
          supportingActIds: [{ bandId: "band-s1", sortOrder: 0 }],
        },
      ],
      _count: { attendees: 1 },
    }
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(createdFork as any)
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([
      { id: "c-match" },
    ] as any)
    // existing attendance on matching concert => no prisma.userConcert.create
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-existing-match",
      userId,
      concertId: "c-match",
      cost: 99,
      notes: null,
      supportingActIds: [],
    } as any)

    vi.mocked(prisma.userConcert.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "c-match",
      date: new Date("2024-06-02T00:00:00.000Z"),
      latitude: 52.52,
      longitude: 13.4,
      venue: "Merged Venue",
      normalizedCity: "Berlin",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        { bandId: "band-1", isHeadliner: true, sortOrder: 0, band: headliner },
      ],
      attendees: [
        {
          id: "att-existing-match",
          userId,
          concertId: "c-match",
          cost: 99,
          notes: null,
          supportingActIds: [],
        },
      ],
      _count: { attendees: 2 },
    } as any)

    const result = await updateConcert("c-source", userId, {
      date: new Date("2024-06-02T00:00:00.000Z"),
      bandIds: [
        { bandId: "band-1", isHeadliner: true },
        { bandId: "band-s1", isHeadliner: false },
      ],
    })

    expect(result?.id).toBe("c-match")
    expect(prisma.userConcert.create).not.toHaveBeenCalled()
  })

  test("multi-attendee hard guard strips bandIds, updates support acts, and still updates attendance cost", async () => {
    const userId = "user-2"
    const band = mkBand("band-1", "Band 1", "band-1")
    const existing = {
      id: "c-hard-guard",
      date: new Date("2024-07-01T00:00:00.000Z"),
      latitude: 50,
      longitude: 8,
      venue: "Venue",
      normalizedCity: "City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [{ bandId: "band-1", isHeadliner: true, sortOrder: 0, band }],
      _count: { attendees: 3 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-hg",
      userId,
      concertId: "c-hard-guard",
      cost: 10,
      notes: null,
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)
    vi.mocked(prisma.userConcert.update).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      attendees: [
        {
          id: "att-hg",
          userId,
          concertId: "c-hard-guard",
          cost: 25,
          notes: null,
          supportingActIds: [],
        },
      ],
    } as any)
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([] as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      attendees: [
        {
          id: "att-hg",
          userId,
          concertId: "c-hard-guard",
          cost: 25,
          notes: null,
          supportingActIds: [],
        },
      ],
      _count: { attendees: 3 },
    } as any)

    const result = await updateConcert("c-hard-guard", userId, {
      // keeps forkTrigger false but makes noCoreFieldChanged false
      isFestival: true,
      cost: 25,
      bandIds: [
        { bandId: "band-1", isHeadliner: true },
        { bandId: "band-support", isHeadliner: false },
      ],
    })

    expect(result).not.toBeNull()
    expect(prisma.userConcert.update).toHaveBeenCalledTimes(2)
    expect(prisma.concertBand.deleteMany).not.toHaveBeenCalled()
  })

  test("single-attendee band rewrite and shared geo update execute band and geocoding branches", async () => {
    const userId = "user-3"
    const oldHeadliner = mkBand("band-old", "Old", "old")
    const newHeadliner = mkBand("band-new", "New", "new")
    const existing = {
      id: "c-single",
      date: new Date("2024-08-10T00:00:00.000Z"),
      latitude: 1,
      longitude: 2,
      venue: "Old Venue",
      normalizedCity: "Old City",
      isFestival: false,
      festivalId: null,
      festival: null,
      bands: [
        {
          bandId: "band-old",
          isHeadliner: true,
          sortOrder: 0,
          band: oldHeadliner,
        },
      ],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: "att-single",
      userId,
      concertId: "c-single",
      cost: 30,
      notes: "a",
      supportingActIds: [],
    } as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existing as any)
    vi.mocked(prisma.userConcert.update).mockResolvedValue({} as any)
    vi.mocked(prisma.concertBand.deleteMany).mockResolvedValue({} as any)
    vi.mocked(prisma.concertBand.create).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.update).mockResolvedValue({} as any)

    // post-update check for potential matching concert
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      id: "c-single",
      date: new Date("2024-08-10T00:00:00.000Z"),
      latitude: 3,
      longitude: 4,
      bands: [{ bandId: "band-new", isHeadliner: true }],
    } as any)
    vi.mocked(prisma.concert.findMany).mockResolvedValueOnce([] as any)

    // final fetch
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce({
      ...existing,
      latitude: 3,
      longitude: 4,
      bands: [
        {
          bandId: "band-new",
          isHeadliner: true,
          sortOrder: 0,
          band: newHeadliner,
        },
      ],
      attendees: [
        {
          id: "att-single",
          userId,
          concertId: "c-single",
          cost: 31,
          notes: "b",
          supportingActIds: [{ bandId: "band-support", sortOrder: 0 }],
        },
      ],
    } as any)
    vi.mocked(prisma.band.findMany).mockResolvedValueOnce([
      mkBand("band-support", "Support", "support"),
    ] as any)

    const result = await updateConcert("c-single", userId, {
      latitude: 3,
      longitude: 4,
      cost: 31,
      notes: "b",
      bandIds: [
        { bandId: "band-new", isHeadliner: true },
        { bandId: "band-support", isHeadliner: false },
      ],
    })

    expect(result?.id).toBe("c-single")
    expect(prisma.concertBand.deleteMany).toHaveBeenCalledWith({
      where: { concertId: "c-single" },
    })
    expect(prisma.concertBand.create).toHaveBeenCalled()
    expect(prisma.concert.update).toHaveBeenCalled()
  })
})
