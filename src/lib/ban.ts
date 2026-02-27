import { prisma } from "./prisma"

export interface BanStatus {
  banned: boolean
  reason?: string | null
  expiresAt?: Date | null
}

/**
 * Check if a user is banned and handle auto-unban for expired bans.
 * Returns ban status with reason and expiration if still banned.
 */
export async function checkUserBan(userId: string): Promise<BanStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      banned: true,
      banReason: true,
      banExpires: true,
      name: true,
      email: true,
    },
  })

  if (!user?.banned) {
    return { banned: false }
  }

  // Check if ban has expired
  if (user.banExpires && new Date(user.banExpires) < new Date()) {
    // Auto-unban the user
    await prisma.user.update({
      where: { id: userId },
      data: { banned: false, banReason: null, banExpires: null },
    })

    return { banned: false }
  }

  return {
    banned: true,
    reason: user.banReason,
    expiresAt: user.banExpires,
  }
}
