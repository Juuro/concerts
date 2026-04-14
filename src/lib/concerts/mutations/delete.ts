import { prisma } from "../../prisma"

export type DeleteConcertResult = {
  removedAttendance: boolean
  deletedConcert: boolean
}

export async function deleteConcert(
  id: string,
  userId: string
): Promise<DeleteConcertResult> {
  return prisma.$transaction(async (tx) => {
    // Verify user has attendance.
    const attendance = await tx.userConcert.findUnique({
      where: { userId_concertId: { userId, concertId: id } },
    })

    if (!attendance) {
      return {
        removedAttendance: false,
        deletedConcert: false,
      }
    }

    // Delete the user's attendance (unlink from concert).
    await tx.userConcert.delete({
      where: { id: attendance.id },
    })

    // Atomically delete orphaned concert, if no attendees remain.
    const deletedConcert = await tx.concert.deleteMany({
      where: {
        id,
        attendees: {
          none: {},
        },
      },
    })

    return {
      removedAttendance: true,
      deletedConcert: deletedConcert.count > 0,
    }
  })
}
