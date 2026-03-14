"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import BandManagement from "./BandManagement"
import ConcertManagement from "./ConcertManagement"
import FestivalManagement from "./FestivalManagement"
import BandMerge from "./BandMerge"
import UserManagement from "./UserManagement"

type TabType = "enrichment" | "cleanup" | "users"

interface Tab {
  id: TabType
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  {
    id: "enrichment",
    label: "Data Enrichment",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="18"
        height="18"
      >
        <path d="M12 3v3m6.366 1.634-2.12 2.12M21 12h-3m-1.634 6.366-2.12-2.12M12 21v-3m-6.366-1.634 2.12-2.12M3 12h3m1.634-6.366 2.12 2.12" />
      </svg>
    ),
  },
  {
    id: "cleanup",
    label: "Data Cleanup",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="18"
        height="18"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
    ),
  },
  {
    id: "users",
    label: "User Management",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="18"
        height="18"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

interface AdminManagementTabsProps {
  defaultTab?: TabType
}

const VALID_TABS: TabType[] = ["enrichment", "cleanup", "users"]

export default function AdminManagementTabs({
  defaultTab = "enrichment",
}: AdminManagementTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tabParam = searchParams.get("tab")
  const activeTab =
    tabParam && VALID_TABS.includes(tabParam as TabType)
      ? (tabParam as TabType)
      : defaultTab

  const handleTabClick = (tabId: TabType) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tabId)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div id="management" className="admin-management admin-management--connected">
      <div
        className="admin-management-tabs"
        role="tablist"
        aria-label="Admin management sections"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`management-panel-${tab.id}`}
            id={`management-tab-${tab.id}`}
            className={`admin-management-tabs__tab admin-management-tabs__tab--${tab.id} ${
              activeTab === tab.id ? "admin-management-tabs__tab--active" : ""
            }`}
            data-position={index === 0 ? "first" : index === TABS.length - 1 ? "last" : "middle"}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`management-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`management-tab-${activeTab}`}
        className="admin-management-tabs__panel"
        data-active-tab={activeTab}
      >
        {activeTab === "enrichment" && (
          <div className="admin-management-tabs__content-grid">
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
                  <h2
                    id="bands-heading"
                    className="admin-dashboard__section-title"
                  >
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
          </div>
        )}

        {activeTab === "cleanup" && (
          <div className="admin-management-tabs__content-grid">
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
                  <h2
                    id="merge-heading"
                    className="admin-dashboard__section-title"
                  >
                    Merge Duplicate Bands
                  </h2>
                  <p className="admin-dashboard__section-desc">
                    Find and merge bands with similar names
                  </p>
                </div>
              </div>
              <BandMerge />
            </section>
          </div>
        )}

        {activeTab === "users" && (
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
                <h2
                  id="users-heading"
                  className="admin-dashboard__section-title"
                >
                  User Management
                </h2>
                <p className="admin-dashboard__section-desc">
                  View users and manage account bans
                </p>
              </div>
            </div>
            <UserManagement />
          </section>
        )}
      </div>
    </div>
  )
}
