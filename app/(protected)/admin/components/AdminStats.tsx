import { prisma } from "@/lib/prisma"
import { ReactNode } from "react"

type IconType = "users" | "concerts" | "bands" | "festivals"

interface StatCard {
  value: number
  label: string
  icon: IconType
}

const ICONS: Record<IconType, ReactNode> = {
  users: (
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
  concerts: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  ),
  bands: (
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
  festivals: (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12a8 8 0 0 1 16 0" />
      <path d="M12 4v4" />
      <path d="M4 12h16" />
      <path d="m8 8 2.8 2.8" />
      <path d="m16 8-2.8 2.8" />
      <path d="M12 20v-8" />
      <path d="M8 20h8" />
    </svg>
  ),
}

async function getTotalStats() {
  const [userCount, concertCount, bandCount, festivalCount] = await Promise.all(
    [
      prisma.user.count(),
      prisma.concert.count(),
      prisma.band.count(),
      prisma.festival.count(),
    ]
  )

  return { userCount, concertCount, bandCount, festivalCount }
}

function StatCardComponent({ value, label, icon }: StatCard) {
  return (
    <div className="admin-stats__card admin-stats__card--featured">
      <div className="admin-stats__icon">{ICONS[icon]}</div>
      <div className="admin-stats__value">{value.toLocaleString()}</div>
      <div className="admin-stats__label">{label}</div>
    </div>
  )
}

export default async function AdminStats() {
  const stats = await getTotalStats()

  const totalStats: StatCard[] = [
    { value: stats.userCount, label: "Users", icon: "users" },
    { value: stats.concertCount, label: "Concerts", icon: "concerts" },
    { value: stats.bandCount, label: "Bands", icon: "bands" },
    { value: stats.festivalCount, label: "Festivals", icon: "festivals" },
  ]

  return (
    <div className="admin-stats">
      <div className="admin-stats__group admin-stats__group--totals">
        <div className="admin-stats__grid admin-stats__grid--featured">
          {totalStats.map((stat) => (
            <StatCardComponent key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </div>
  )
}
