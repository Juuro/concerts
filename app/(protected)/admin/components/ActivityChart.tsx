import { prisma } from "@/lib/prisma"
import BarChart from "@/components/BarChart/barchart"

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

export default async function ActivityChart() {
  const stats = await getActivityStats()

  const data: [string, number][] = [
    ["Today", stats.concertsToday],
    ["This Week", stats.concertsThisWeek],
    ["This Month", stats.concertsThisMonth],
    ["This Year", stats.concertsThisYear],
  ]

  const maxValue = Math.max(...data.map((d) => d[1]), 1)

  return (
    <div className="activity-chart">
      <BarChart
        data={data}
        max={maxValue}
        title="Concerts Added"
        category="activity"
      />
    </div>
  )
}
