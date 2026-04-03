/**
 * Phase 5: Additional Branch Coverage tests extracted from `src/lib/concerts.test.ts`.
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { getUserTotalSpent } from "@/lib/concerts/spending"
import { getConcertStatistics } from "@/lib/concerts/stats"
import { updateConcert } from "@/lib/concerts/mutations/update"
import { getUserConcerts } from "@/lib/concerts/read"
import { mockConcertCountPastFuture } from "./testUtils"

// Mock external utilities
vi.mock("@/utils/data", () => ({
  getGeocodingData: vi.fn().mockResolvedValue({
    _normalized_city: "Test City",
    _is_coordinates: false,
  }),
}))

describe("Additional Branch Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getUserTotalSpent additional paths", () => {
    test("test_getUserTotalSpent_pastOnly_no_band_uses_prisma_aggregate", async () => {
      const userId = "user-past-only"
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"))

      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 500 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        currency: "EUR",
      } as any)

      const result = await getUserTotalSpent(userId, { pastOnly: true })

      expect(result.total).toBe(500)
      expect(result.currency).toBe("EUR")
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

    test("test_getUserTotalSpent_city_filter_uses_prisma_aggregate", async () => {
      const userId = "user-city-filter"

      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 200 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        currency: "USD",
      } as any)

      const result = await getUserTotalSpent(userId, { city: "Berlin" })

      expect(result.total).toBe(200)
      expect(result.currency).toBe("USD")
      expect(prisma.userConcert.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            concert: expect.objectContaining({
              normalizedCity: "Berlin",
            }),
          }),
        })
      )
    })

    test("test_getUserTotalSpent_year_filter_uses_prisma_aggregate", async () => {
      const userId = "user-year-filter"

      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 350 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        currency: "EUR",
      } as any)

      const result = await getUserTotalSpent(userId, { year: 2023 })

      expect(result.total).toBe(350)
      expect(prisma.userConcert.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            concert: expect.objectContaining({
              date: {
                gte: new Date(Date.UTC(2023, 0, 1, 0, 0, 0, 0)),
                lte: new Date(Date.UTC(2023, 11, 31, 23, 59, 59, 999)),
              },
            }),
          }),
        })
      )
    })

    test("test_getUserTotalSpent_bandSlug_not_found_falls_through_to_aggregate", async () => {
      const userId = "user-no-band"

      // Band not found by slug
      vi.mocked(prisma.band.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.userConcert.aggregate).mockResolvedValue({
        _sum: { cost: 100 },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        currency: "EUR",
      } as any)

      const result = await getUserTotalSpent(userId, {
        bandSlug: "nonexistent",
      })

      expect(result.total).toBe(100)
      // Falls through to aggregate path since band not found
      expect(prisma.userConcert.aggregate).toHaveBeenCalled()
    })
  })

  describe("getConcertStatistics past/future counts", () => {
    test("test_getConcertStatistics_includes_past_and_future_totals", async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"))

      vi.mocked(prisma.concert.groupBy).mockResolvedValue([])
      vi.mocked(prisma.concertBand.groupBy).mockResolvedValue([])
      vi.mocked(prisma.band.findMany).mockResolvedValue([])
      vi.mocked(prisma.concertBand.count).mockResolvedValue(0)

      // Mock past and future counts
      mockConcertCountPastFuture(prisma, { past: 100, future: 10 })

      const stats = await getConcertStatistics()

      expect(stats.totalPast).toBe(100)
      expect(stats.totalFuture).toBe(10)

      vi.useRealTimers()
    })
  })

  describe("updateConcert support-act-only edit", () => {
    test("test_updateConcert_support_act_only_does_not_fork", async () => {
      const userId = "user-support-edit"
      const concertId = "concert-support-edit"

      vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
        id: "attendance-support",
        userId,
        concertId,
        cost: 50,
        notes: null,
        supportingActIds: [],
      } as any)

      const existing = {
        id: concertId,
        date: new Date("2024-08-15"),
        latitude: 52.52,
        longitude: 13.405,
        venue: "Venue X",
        normalizedCity: "Berlin",
        isFestival: false,
        festivalId: null,
        bands: [
          {
            bandId: "band-headliner",
            isHeadliner: true,
            sortOrder: 0,
            band: {
              id: "band-headliner",
              name: "Headliner",
              slug: "headliner",
            },
          },
        ],
        festival: null,
        _count: { attendees: 1 },
      }

      // 1st findUnique: fetch existing
      vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(
        existing as any
      )
      // userConcert.update for support acts
      vi.mocked(prisma.userConcert.update).mockResolvedValueOnce({} as any)

      const updatedConcertResult = {
        ...existing,
        attendees: [
          {
            id: "attendance-support",
            userId,
            concertId,
            cost: 50,
            notes: null,
            supportingActIds: [{ bandId: "band-support-new", sortOrder: 0 }],
          },
        ],
      }

      // 2nd findUnique: re-fetch after support-act update
      vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(
        updatedConcertResult as any
      )

      // findUnique for updated attendance
      vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
        id: "attendance-support",
        userId,
        concertId,
        cost: 50,
        notes: null,
        supportingActIds: [{ bandId: "band-support-new", sortOrder: 0 }],
      } as any)

      const supportBand = {
        id: "band-support-new",
        name: "Support New",
        slug: "support-new",
      }
      vi.mocked(prisma.band.findMany).mockResolvedValue([supportBand] as any)

      const result = await updateConcert(concertId, userId, {
        bandIds: [
          { bandId: "band-headliner", isHeadliner: true },
          { bandId: "band-support-new", isHeadliner: false },
        ],
      })

      expect(result).not.toBeNull()

      // Support-act-only edit: no fork, no concert.update on shared data
      expect(prisma.$transaction).not.toHaveBeenCalled()

      // UserConcert updated with new supportingActIds
      expect(prisma.userConcert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supportingActIds: [{ bandId: "band-support-new", sortOrder: 0 }],
          }),
        })
      )
    })
  })

  describe("getUserConcerts", () => {
    test("test_getUserConcerts_returns_transformed_concerts_for_user", async () => {
      const userId = "user-concerts-1"

      const mockBand = {
        id: "band-uc-1",
        name: "User Band",
        slug: "user-band",
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
          id: "uc-1",
          userId,
          concertId: "c-1",
          cost: 50,
          notes: "Good show",
          supportingActIds: [],
          concert: {
            id: "c-1",
            date: new Date("2024-03-15"),
            latitude: 52.52,
            longitude: 13.405,
            venue: "Berlin Venue",
            normalizedCity: "Berlin",
            isFestival: false,
            festivalId: null,
            createdById: userId,
            updatedById: null,
            bands: [
              {
                concertId: "c-1",
                bandId: "band-uc-1",
                isHeadliner: true,
                sortOrder: 0,
                band: mockBand,
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

      const result = await getUserConcerts(userId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("c-1")
      expect(result[0].venue).toBe("Berlin Venue")
      expect(result[0].attendance).toBeDefined()
      expect(result[0].attendance!.cost).toBe("50")
    })
  })
})
