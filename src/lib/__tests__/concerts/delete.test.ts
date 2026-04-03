import { describe, test, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { deleteConcert } from "@/lib/concerts/mutations/delete"

describe("deleteConcert", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("test_deleteConcert_non_attendee_returns_false", async () => {
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue(null)
    const result = await deleteConcert("concert-1", "user-2")
    expect(result).toEqual({
      removedAttendance: false,
      deletedConcert: false,
    })
  })

  test("test_deleteConcert_removes_attendance_and_orphaned_concert", async () => {
    vi.mocked(prisma.userConcert.findUnique).mockResolvedValue({
      id: "attendance-1",
      userId: "user-1",
      concertId: "concert-1",
    } as any)
    vi.mocked(prisma.userConcert.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.concert.deleteMany).mockResolvedValue({ count: 1 } as any)
    const result = await deleteConcert("concert-1", "user-1")
    expect(result).toEqual({
      removedAttendance: true,
      deletedConcert: true,
    })
    expect(prisma.concert.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "concert-1",
        attendees: {
          none: {},
        },
      },
    })
  })
})
