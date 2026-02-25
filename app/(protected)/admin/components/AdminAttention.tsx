import { prisma } from "@/lib/prisma"
import { ReactNode } from "react"

type IconType = "image" | "image-x" | "link" | "orphan" | "location" | "ban"
type Variant = "default" | "warning" | "danger" | "success"

interface StatCard {
  value: number
  label: string
  icon: IconType
  variant: Variant
}

const ICONS: Record<IconType, ReactNode> = {
  image: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),
  "image-x": (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15V6a2 2 0 0 0-2-2H6" />
      <path d="m2 2 20 20" />
      <path d="M14 14a2 2 0 0 1-2-2" />
      <path d="M21 21H4a2 2 0 0 1-2-2V6" />
    </svg>
  ),
  link: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  orphan: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),
  location: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  ban: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  ),
}

async function getAttentionStats() {
  const [
    bandsWithoutImages,
    bandsEnrichmentFailed,
    bandsWithoutLastfm,
    orphanedBands,
    orphanedFestivals,
    concertsWithoutCity,
    bannedUsers,
  ] = await Promise.all([
    prisma.band.count({
      where: { imageUrl: null, imageEnrichedAt: null },
    }),
    prisma.band.count({
      where: { imageUrl: null, imageEnrichedAt: { not: null } },
    }),
    prisma.band.count({
      where: { lastfmUrl: null },
    }),
    prisma.band.count({
      where: { concerts: { none: {} } },
    }),
    prisma.festival.count({
      where: { concerts: { none: {} } },
    }),
    prisma.concert.count({
      where: { normalizedCity: null },
    }),
    prisma.user.count({ where: { banned: true } }),
  ])

  return {
    bandsWithoutImages,
    bandsEnrichmentFailed,
    bandsWithoutLastfm,
    orphanedBands,
    orphanedFestivals,
    concertsWithoutCity,
    bannedUsers,
  }
}

function StatCardComponent({ value, label, icon, variant }: StatCard) {
  const variantClass =
    variant === "warning"
      ? "admin-stats__card--warning"
      : variant === "danger"
        ? "admin-stats__card--danger"
        : variant === "success"
          ? "admin-stats__card--success"
          : ""

  return (
    <div className={`admin-stats__card ${variantClass}`}>
      <div className="admin-stats__icon">{ICONS[icon]}</div>
      <div className="admin-stats__value">{value.toLocaleString()}</div>
      <div className="admin-stats__label">{label}</div>
    </div>
  )
}

export default async function AdminAttention() {
  const stats = await getAttentionStats()

  const attentionStats: StatCard[] = [
    {
      value: stats.bandsWithoutImages,
      label: "Missing Images",
      icon: "image",
      variant: stats.bandsWithoutImages > 0 ? "warning" : "success",
    },
    {
      value: stats.bandsEnrichmentFailed,
      label: "Enrichment Failed",
      icon: "image-x",
      variant: stats.bandsEnrichmentFailed > 0 ? "warning" : "success",
    },
    {
      value: stats.bandsWithoutLastfm,
      label: "Missing Last.fm",
      icon: "link",
      variant: stats.bandsWithoutLastfm > 0 ? "warning" : "success",
    },
    {
      value: stats.orphanedBands,
      label: "Orphaned Bands",
      icon: "orphan",
      variant: stats.orphanedBands > 0 ? "warning" : "success",
    },
    {
      value: stats.orphanedFestivals,
      label: "Orphaned Festivals",
      icon: "orphan",
      variant: stats.orphanedFestivals > 0 ? "warning" : "success",
    },
    {
      value: stats.concertsWithoutCity,
      label: "Missing City",
      icon: "location",
      variant: stats.concertsWithoutCity > 0 ? "warning" : "success",
    },
    {
      value: stats.bannedUsers,
      label: "Banned Users",
      icon: "ban",
      variant: stats.bannedUsers > 0 ? "danger" : "success",
    },
  ]

  return (
    <div className="admin-stats">
      <div className="admin-stats__group admin-stats__group--attention">
        <div className="admin-stats__grid admin-stats__grid--attention">
          {attentionStats.map((stat) => (
            <StatCardComponent key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </div>
  )
}
