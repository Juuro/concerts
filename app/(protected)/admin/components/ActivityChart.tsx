import { prisma } from "@/lib/prisma"

function getStartOfDay(date: Date): Date {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function getStartOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getUTCDay()
  const diff = result.getUTCDate() - day + (day === 0 ? -6 : 1)
  result.setUTCDate(diff)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function getStartOfMonth(date: Date): Date {
  const result = new Date(date)
  result.setUTCDate(1)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

function getStartOfYear(date: Date): Date {
  const result = new Date(date)
  result.setUTCMonth(0, 1)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

async function getActivityStats() {
  const now = new Date()
  const startOfDay = getStartOfDay(now)
  const startOfWeek = getStartOfWeek(now)
  const startOfMonth = getStartOfMonth(now)
  const startOfYear = getStartOfYear(now)

  const [concertsToday, concertsThisWeek, concertsThisMonth, concertsThisYear] =
    await Promise.all([
      prisma.concert.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.concert.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.concert.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.concert.count({ where: { createdAt: { gte: startOfYear } } }),
    ])

  return {
    concertsToday,
    concertsThisWeek,
    concertsThisMonth,
    concertsThisYear,
  }
}

function StatValue({
  value,
  className,
}: {
  value: number
  className: string
}) {
  const displayValue = value.toLocaleString()
  return (
    <span
      className={className}
      data-value-length={displayValue.length}
    >
      {displayValue}
    </span>
  )
}

export default async function ActivityChart() {
  const stats = await getActivityStats()

  return (
    <div className="activity-compact">
      <div className="activity-compact__primary">
        <StatValue
          value={stats.concertsThisYear}
          className="activity-compact__value"
        />
        <span className="activity-compact__label">This Year</span>
      </div>
      <div className="activity-compact__secondary">
        <div className="activity-compact__item">
          <StatValue
            value={stats.concertsToday}
            className="activity-compact__item-value"
          />
          <span className="activity-compact__item-label">Today</span>
        </div>
        <div className="activity-compact__item">
          <StatValue
            value={stats.concertsThisWeek}
            className="activity-compact__item-value"
          />
          <span className="activity-compact__item-label">Week</span>
        </div>
        <div className="activity-compact__item">
          <StatValue
            value={stats.concertsThisMonth}
            className="activity-compact__item-value"
          />
          <span className="activity-compact__item-label">Month</span>
        </div>
      </div>
    </div>
  )
}
