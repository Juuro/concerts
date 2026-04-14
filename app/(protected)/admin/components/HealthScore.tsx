import { prisma } from "@/lib/prisma"

interface HealthMetric {
  label: string
  score: number
}

async function calculateHealthScore(): Promise<{
  overall: number
  metrics: HealthMetric[]
}> {
  const [
    totalBands,
    bandsWithImages,
    totalConcerts,
    concertsWithCity,
    totalFestivals,
    activeFestivals,
  ] = await Promise.all([
    prisma.band.count(),
    prisma.band.count({ where: { imageUrl: { not: null } } }),
    prisma.concert.count(),
    prisma.concert.count({ where: { normalizedCity: { not: null } } }),
    prisma.festival.count(),
    prisma.festival.count({ where: { concerts: { some: {} } } }),
  ])

  const bandScore =
    totalBands > 0 ? Math.round((bandsWithImages / totalBands) * 100) : 100
  const concertScore =
    totalConcerts > 0
      ? Math.round((concertsWithCity / totalConcerts) * 100)
      : 100
  const festivalScore =
    totalFestivals > 0
      ? Math.round((activeFestivals / totalFestivals) * 100)
      : 100

  const overall = Math.round((bandScore + concertScore + festivalScore) / 3)

  return {
    overall,
    metrics: [
      { label: "Bands", score: bandScore },
      { label: "Concerts", score: concertScore },
      { label: "Festivals", score: festivalScore },
    ],
  }
}

export default async function HealthScore() {
  const health = await calculateHealthScore()

  // SVG parameters for the ring
  const size = 180
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (health.overall / 100) * circumference
  const offset = circumference - progress

  // Determine gradient colors based on health level
  // High health (80+): pink gradient, Medium (50-79): amber, Low (<50): red
  const gradientStart =
    health.overall >= 80
      ? "#ff0666"
      : health.overall >= 50
        ? "#f59e0b"
        : "#ef4444"
  const gradientEnd =
    health.overall >= 80
      ? "#ff6ba3"
      : health.overall >= 50
        ? "#fbbf24"
        : "#f87171"

  return (
    <div className="health-score">
      <div className="health-score__ring">
        <svg
          className="health-score__svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <defs>
            <linearGradient
              id="health-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={gradientStart} />
              <stop offset="100%" stopColor={gradientEnd} />
            </linearGradient>
          </defs>
          <circle
            className="health-score__track"
            cx={size / 2}
            cy={size / 2}
            r={radius}
          />
          <circle
            className="health-score__progress"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="health-score__value">
          <div className="health-score__percentage">{health.overall}%</div>
          <div className="health-score__label">Health</div>
        </div>
      </div>
      <div className="health-score__breakdown">
        {health.metrics.map((metric) => (
          <div key={metric.label} className="health-score__breakdown-item">
            <span className="health-score__breakdown-label">
              {metric.label}
            </span>
            <span className="health-score__breakdown-value">
              {metric.score}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
