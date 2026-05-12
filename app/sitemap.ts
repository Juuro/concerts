import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://concertivity.app"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/imprint`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ]

  // Include public user profiles in the sitemap
  const publicUsers = await prisma.user.findMany({
    where: { isPublic: true, username: { not: null } },
    select: { username: true, updatedAt: true },
  })

  const profilePages: MetadataRoute.Sitemap = publicUsers.map((user) => ({
    url: `${siteUrl}/u/${user.username}`,
    lastModified: user.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }))

  return [...staticPages, ...profilePages]
}
