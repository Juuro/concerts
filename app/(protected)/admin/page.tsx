import { connection } from "next/server"
import { Metadata } from "next"
import AdminStats from "./components/AdminStats"
import AdminAttention from "./components/AdminAttention"
import ActivityChart from "./components/ActivityChart"
import ActivityLog from "./components/ActivityLog"
import HealthScore from "./components/HealthScore"
import AdminManagementTabs from "./components/AdminManagementTabs"
import "./admin.scss"

export const metadata: Metadata = {
  title: "Admin Dashboard | My Concerts",
  description: "Admin dashboard for managing bands, concerts, and users",
}

export default async function AdminPage() {
  await connection()
  return (
    <div className="admin-page">
      <div className="admin-dashboard">
        <div className="admin-header">
          <h1 className="admin-header__title">Admin Dashboard</h1>
          <p className="admin-header__subtitle">
            Monitor and manage bands, concerts, festivals, and users
          </p>
        </div>

        {/* Zone A: Monitoring - Bento Grid Layout */}
        <div className="admin-dashboard__bento-grid">
          {/* Row 1: Stats + Activity Chart */}
          <section
            className="admin-dashboard__section admin-dashboard__section--stats"
            aria-labelledby="stats-heading"
          >
            <div className="admin-dashboard__section-header">
              <svg
                aria-hidden="true"
                className="admin-dashboard__section-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
              <div>
                <h2 id="stats-heading" className="admin-dashboard__section-title">
                  Overview
                </h2>
                <p className="admin-dashboard__section-desc">
                  System-wide statistics at a glance
                </p>
              </div>
            </div>
            <AdminStats />
          </section>

          <section
            className="admin-dashboard__section admin-dashboard__section--activity"
            aria-labelledby="chart-heading"
          >
            <div className="admin-dashboard__section-header">
              <svg
                aria-hidden="true"
                className="admin-dashboard__section-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <div>
                <h2 id="chart-heading" className="admin-dashboard__section-title">
                  Recent Activity
                </h2>
                <p className="admin-dashboard__section-desc">
                  Concerts added over time
                </p>
              </div>
            </div>
            <ActivityChart />
          </section>

          {/* Row 2: Attention Clusters - Full Width */}
          <section
            className="admin-dashboard__bento-item admin-dashboard__bento-item--wide"
            aria-labelledby="attention-heading"
          >
            <h2 id="attention-heading" className="visually-hidden">
              Needs Attention
            </h2>
            <AdminAttention />
          </section>

          {/* Row 3: Activity Log + Health Score */}
          <section
            className="admin-dashboard__section admin-dashboard__section--log"
            aria-labelledby="log-heading"
          >
            <div className="admin-dashboard__section-header">
              <svg
                aria-hidden="true"
                className="admin-dashboard__section-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <div>
                <h2 id="log-heading" className="admin-dashboard__section-title">
                  Live Pulse
                  <span className="activity-log__live-badge">Live</span>
                </h2>
                <p className="admin-dashboard__section-desc">
                  Real-time admin activity stream
                </p>
              </div>
            </div>
            <ActivityLog />
          </section>

          <section
            className="admin-dashboard__section admin-dashboard__section--health"
            aria-labelledby="health-heading"
          >
            <div className="admin-dashboard__section-header">
              <svg
                aria-hidden="true"
                className="admin-dashboard__section-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <div>
                <h2 id="health-heading" className="admin-dashboard__section-title">
                  Health Score
                </h2>
                <p className="admin-dashboard__section-desc">
                  Overall data quality metric
                </p>
              </div>
            </div>
            <HealthScore />
          </section>

        </div>

        {/* Zone B: Management - Tabbed Interface */}
        <AdminManagementTabs />
      </div>
    </div>
  )
}
