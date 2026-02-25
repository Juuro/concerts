import { Metadata } from "next"
import AdminStats from "./components/AdminStats"
import AdminAttention from "./components/AdminAttention"
import ActivityChart from "./components/ActivityChart"
import BandManagement from "./components/BandManagement"
import BandMerge from "./components/BandMerge"
import FestivalManagement from "./components/FestivalManagement"
import ConcertManagement from "./components/ConcertManagement"
import UserManagement from "./components/UserManagement"
import ActivityLog from "./components/ActivityLog"
import "./admin.scss"

export const metadata: Metadata = {
  title: "Admin Dashboard | My Concerts",
  description: "Admin dashboard for managing bands, concerts, and users",
}

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1 className="admin-header__title">Admin Dashboard</h1>
        <p className="admin-header__subtitle">
          Monitor and manage bands, concerts, festivals, and users
        </p>
      </div>

      {/* Top row: Stats + Activity Chart side by side */}
      <div className="admin-dashboard__top-grid">
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
      </div>

      {/* Attention section - full width */}
      <section
        className="admin-dashboard__section admin-dashboard__section--attention"
        aria-labelledby="attention-heading"
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
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <div>
            <h2
              id="attention-heading"
              className="admin-dashboard__section-title"
            >
              Needs Attention
            </h2>
            <p className="admin-dashboard__section-desc">
              Items requiring admin action
            </p>
          </div>
        </div>
        <AdminAttention />
      </section>

      {/* Activity Log - full width */}
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
              Activity Log
            </h2>
            <p className="admin-dashboard__section-desc">
              Track admin actions across the system
            </p>
          </div>
        </div>
        <ActivityLog />
      </section>

      {/* Management sections - 2 columns */}
      <div className="admin-dashboard__management-grid">
        <section
          className="admin-dashboard__section admin-dashboard__section--bands"
          aria-labelledby="bands-heading"
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
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="10" r="3" />
              <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
            </svg>
            <div>
              <h2 id="bands-heading" className="admin-dashboard__section-title">
                Band Management
              </h2>
              <p className="admin-dashboard__section-desc">
                Enrich missing data and clean up orphaned bands
              </p>
            </div>
          </div>
          <BandManagement />
        </section>

        <section
          className="admin-dashboard__section admin-dashboard__section--festivals"
          aria-labelledby="festivals-heading"
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
              <path d="M4 12a8 8 0 0 1 16 0" />
              <path d="M12 4v4" />
              <path d="M4 12h16" />
              <path d="m8 8 2.8 2.8" />
              <path d="m16 8-2.8 2.8" />
              <path d="M12 20v-8" />
              <path d="M8 20h8" />
            </svg>
            <div>
              <h2
                id="festivals-heading"
                className="admin-dashboard__section-title"
              >
                Festival Management
              </h2>
              <p className="admin-dashboard__section-desc">
                Clean up orphaned festivals with no concerts
              </p>
            </div>
          </div>
          <FestivalManagement />
        </section>
      </div>

      {/* Band Merge - full width */}
      <section
        className="admin-dashboard__section admin-dashboard__section--merge"
        aria-labelledby="merge-heading"
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
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M6 9v6" />
            <path d="M18 15c0-6-12-6-12 0" />
          </svg>
          <div>
            <h2 id="merge-heading" className="admin-dashboard__section-title">
              Merge Duplicate Bands
            </h2>
            <p className="admin-dashboard__section-desc">
              Find and merge bands with similar names
            </p>
          </div>
        </div>
        <BandMerge />
      </section>

      {/* Concert Management - full width */}
      <section
        className="admin-dashboard__section admin-dashboard__section--concerts"
        aria-labelledby="concerts-heading"
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
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div>
            <h2
              id="concerts-heading"
              className="admin-dashboard__section-title"
            >
              Concert Data Quality
            </h2>
            <p className="admin-dashboard__section-desc">
              Fix concerts missing city data via geocoding
            </p>
          </div>
        </div>
        <ConcertManagement />
      </section>

      {/* User Management - full width */}
      <section
        className="admin-dashboard__section admin-dashboard__section--users"
        aria-labelledby="users-heading"
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div>
            <h2 id="users-heading" className="admin-dashboard__section-title">
              User Management
            </h2>
            <p className="admin-dashboard__section-desc">
              View users and manage account bans
            </p>
          </div>
        </div>
        <UserManagement />
      </section>
    </div>
  )
}
