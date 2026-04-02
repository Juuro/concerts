import { prisma } from "../../prisma"

export async function deleteConcert(
  id: string,
  userId: string
): Promise<boolean> {
  // Verify user has attendance
  const attendance = await prisma.userConcert.findUnique({
    where: { userId_concertId: { userId, concertId: id } },
  })

  if (!attendance) {
    return false
  }

  // Delete the user's attendance (unlink from concert)
  await prisma.userConcert.delete({
    where: { id: attendance.id },
  })

  // Check if concert is now orphaned (no remaining attendees)
  const remainingAttendees = await prisma.userConcert.count({
    where: { concertId: id },
  })

  if (remainingAttendees === 0) {
    // Delete orphaned concert
    await prisma.concert.delete({
      where: { id },
    })
  }

  return true
}
