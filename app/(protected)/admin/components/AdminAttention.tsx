import { prisma } from "@/lib/prisma"
import AdminAttentionClient from "./AdminAttentionClient"

export interface AttentionStats {
  bandsWithoutImages: number
  totalBands: number
  concertsWithoutCity: number
  totalConcerts: number
  orphanedFestivals: number
  totalFestivals: number
  bannedUsers: number
  totalUsers: number
}

async function getAttentionStats(): Promise<AttentionStats> {
  const [
    bandsWithoutImages,
    totalBands,
    concertsWithoutCity,
    totalConcerts,
    orphanedFestivals,
    totalFestivals,
    bannedUsers,
    totalUsers,
  ] = await Promise.all([
    prisma.band.count({
      where: { imageUrl: null },
    }),
    prisma.band.count(),
    prisma.concert.count({
      where: { normalizedCity: null },
    }),
    prisma.concert.count(),
    prisma.festival.count({
      where: { concerts: { none: {} } },
    }),
    prisma.festival.count(),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count(),
  ])

  return {
    bandsWithoutImages,
    totalBands,
    concertsWithoutCity,
    totalConcerts,
    orphanedFestivals,
    totalFestivals,
    bannedUsers,
    totalUsers,
  }
}

export default async function AdminAttention() {
  const initialStats = await getAttentionStats()
  return <AdminAttentionClient initialStats={initialStats} />
}
