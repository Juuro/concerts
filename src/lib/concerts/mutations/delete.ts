import { prisma } from "../../prisma"

export async function deleteConcert(
  id: string,
  userId: string
): Promise<boolean> {
  return prisma.$transaction(async tx => {
    // Verify user has attendance.
    const attendance = await tx.userConcert.findUnique({
      where: { userId_concertId: { userId, concertId: id } },
    })

    if (!attendance) {
      return false
    }

    // Delete the user's attendance (unlink from concert).
    await tx.userConcert.delete({
      where: { id: attendance.id },
    })

    // Atomically delete orphaned concert, if no attendees remain.
    await tx.concert.deleteMany({
      where: {
        id,
        attendees: {
          none: {},
        },
      },
    })

    return true
  })
}
