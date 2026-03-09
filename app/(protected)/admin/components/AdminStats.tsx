import { prisma } from "@/lib/prisma"

interface Stat {
  value: number
  label: string
}

async function getTotalStats() {
  const [userCount, concertCount, bandCount, festivalCount] = await Promise.all([
    prisma.user.count(),
    prisma.concert.count(),
    prisma.band.count(),
    prisma.festival.count(),
  ])

  return { userCount, concertCount, bandCount, festivalCount }
}

export default async function AdminStats() {
  const stats = await getTotalStats()

  const items: Stat[] = [
    { value: stats.userCount, label: "Users" },
    { value: stats.concertCount, label: "Concerts" },
    { value: stats.bandCount, label: "Bands" },
    { value: stats.festivalCount, label: "Festivals" },
  ]

  return (
    <div className="admin-stats">
      <div className="admin-stats__row">
        {items.map((stat) => {
          const displayValue = stat.value.toLocaleString()
          return (
            <div key={stat.label} className="admin-stats__item">
              <span
                className="admin-stats__value"
                data-value-length={displayValue.length}
              >
                {displayValue}
              </span>
              <span className="admin-stats__label">{stat.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
