import { prisma } from "@/lib/prisma"
import AdminAttentionClient from "./AdminAttentionClient"

export interface AttentionStats {
  /** Bands that have never had image enrichment (`Missing Images` queue). */
  bandsWithoutImages: number
  /** Bands where enrichment ran but `imageUrl` is still null (`Enrichment Failed` queue). */
  bandsEnrichmentFailed: number
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
    bandsEnrichmentFailed,
    totalBands,
    concertsWithoutCity,
    totalConcerts,
    orphanedFestivals,
    totalFestivals,
    bannedUsers,
    totalUsers,
  ] = await Promise.all([
    prisma.band.count({
      where: { imageUrl: null, imageEnrichedAt: null },
    }),
    prisma.band.count({
      where: { imageUrl: null, imageEnrichedAt: { not: null } },
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
    bandsEnrichmentFailed,
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
