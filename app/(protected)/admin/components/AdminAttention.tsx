import { prisma } from "@/lib/prisma"

type Variant = "warning" | "danger" | "success"

interface StatItem {
  value: number
  label: string
  variant: Variant
}

interface ClusterGroup {
  title: string
  type: "band-quality" | "data-quality" | "users"
  icon: React.ReactNode
  items: StatItem[]
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

function StatCard({ value, label, variant }: StatItem) {
  const variantClass =
    variant === "warning"
      ? "admin-attention-cluster__stat--warning"
      : variant === "danger"
        ? "admin-attention-cluster__stat--danger"
        : "admin-attention-cluster__stat--success"

  const needsAttention = variant === "warning" || variant === "danger"

  return (
    <div
      className={`admin-attention-cluster__stat ${variantClass} ${
        needsAttention ? "admin-attention-cluster__stat--needs-attention" : ""
      }`}
    >
      <div className="admin-attention-cluster__value">
        {value.toLocaleString()}
      </div>
      <div className="admin-attention-cluster__label">{label}</div>
    </div>
  )
}

export default async function AdminAttention() {
  const stats = await getAttentionStats()

  const clusters: ClusterGroup[] = [
    {
      title: "Band Quality",
      type: "band-quality",
      icon: (
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
          <circle cx="12" cy="10" r="3" />
          <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
        </svg>
      ),
      items: [
        {
          value: stats.bandsWithoutImages,
          label: "Missing Images",
          variant: stats.bandsWithoutImages > 0 ? "warning" : "success",
        },
        {
          value: stats.bandsEnrichmentFailed,
          label: "Enrichment Failed",
          variant: stats.bandsEnrichmentFailed > 0 ? "warning" : "success",
        },
        {
          value: stats.bandsWithoutLastfm,
          label: "No Last.fm",
          variant: stats.bandsWithoutLastfm > 0 ? "warning" : "success",
        },
      ],
    },
    {
      title: "Data Quality",
      type: "data-quality",
      icon: (
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
      items: [
        {
          value: stats.orphanedBands,
          label: "Orphan Bands",
          variant: stats.orphanedBands > 0 ? "warning" : "success",
        },
        {
          value: stats.orphanedFestivals,
          label: "Orphan Festivals",
          variant: stats.orphanedFestivals > 0 ? "warning" : "success",
        },
        {
          value: stats.concertsWithoutCity,
          label: "Missing City",
          variant: stats.concertsWithoutCity > 0 ? "warning" : "success",
        },
      ],
    },
    {
      title: "Users",
      type: "users",
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      items: [
        {
          value: stats.bannedUsers,
          label: "Banned Users",
          variant: stats.bannedUsers > 0 ? "danger" : "success",
        },
      ],
    },
  ]

  return (
    <div className="admin-attention-cluster">
      {clusters.map((cluster) => (
        <div
          key={cluster.type}
          className={`admin-attention-cluster__group admin-attention-cluster__group--${cluster.type}`}
        >
          <h3 className="admin-attention-cluster__group-title">
            {cluster.icon}
            {cluster.title}
          </h3>
          <div className="admin-attention-cluster__items">
            {cluster.items.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
