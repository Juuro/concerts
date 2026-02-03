import React from "react"
import BarChart from "../BarChart/barchart"
import type { ConcertStatistics } from "@/lib/concerts"
import "./statisticsWidget.scss"

interface StatisticsWidgetServerProps {
  statistics: ConcertStatistics
}

const StatisticsWidgetServer: React.FC<StatisticsWidgetServerProps> = ({
  statistics,
}) => {
  return (
    <div className="card statistics-widget">
      <BarChart
        data={statistics.yearCounts}
        max={statistics.maxYearCount}
        title="most concerts per year"
        category="year"
      />
      <BarChart
        data={statistics.mostSeenBands}
        max={statistics.maxBandCount}
        title="most concerts per band"
        category="band"
      />
      <BarChart
        data={statistics.cityCounts}
        max={statistics.maxCityCount}
        title="most concerts per city"
        category="city"
      />
    </div>
  )
}

export default StatisticsWidgetServer
