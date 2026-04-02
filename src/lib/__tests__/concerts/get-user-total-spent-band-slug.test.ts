/**
 * Phase 6: getUserTotalSpent (bandSlug filter) tests extracted from
 * `src/lib/concerts.test.ts`.
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { getUserTotalSpent } from "@/lib/concerts/spending"

describe("getUserTotalSpent with bandSlug filter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_getUserTotalSpent_bandSlug_uses_raw_sql", async () => {
    // Resolve bandSlug to bandId
    vi.mocked(prisma.band.findUnique).mockResolvedValueOnce({
      id: "band-1",
    } as any)

    // Raw SQL returns total
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ total: 150 }])

    // User currency lookup
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      currency: "USD",
    } as any)

    const result = await getUserTotalSpent("user-1", { bandSlug: "band-a" })

    expect(result.total).toBe(150)
    expect(result.currency).toBe("USD")
    expect(prisma.band.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "band-a" } })
    )
    expect(prisma.$queryRaw).toHaveBeenCalled()
  })
})
