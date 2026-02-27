"use client"

interface QuickAction {
  label: string
  tab: string
  icon: React.ReactNode
}

const ACTIONS: QuickAction[] = [
  {
    label: "Enrich band data",
    tab: "enrichment",
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
        <path d="M12 3v3m6.366 1.634-2.12 2.12M21 12h-3m-1.634 6.366-2.12-2.12M12 21v-3m-6.366-1.634 2.12-2.12M3 12h3m1.634-6.366 2.12 2.12" />
      </svg>
    ),
  },
  {
    label: "Clean up orphans",
    tab: "cleanup",
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
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
    ),
  },
  {
    label: "Manage users",
    tab: "users",
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
  },
]

export default function AdminQuickActions() {
  const handleClick = (tab: string) => {
    const tabElement = document.getElementById(`management-tab-${tab}`)
    if (tabElement) {
      tabElement.click()
      tabElement.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="admin-quick-actions">
      <h3 className="admin-quick-actions__title">Quick Actions</h3>
      <div className="admin-quick-actions__list">
        {ACTIONS.map((action) => (
          <button
            key={action.tab}
            type="button"
            className="admin-quick-actions__item"
            onClick={() => handleClick(action.tab)}
          >
            <span className="admin-quick-actions__icon">{action.icon}</span>
            <span>{action.label}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="16"
              height="16"
              style={{ marginLeft: "auto", opacity: 0.4 }}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
