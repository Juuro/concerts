import { Metadata } from "next"
import ActivityLog from "../components/ActivityLog"

export const metadata: Metadata = {
  title: "Activity Log | Admin",
  description: "Track admin actions across the system",
}

export const dynamic = "force-dynamic"

export default function ActivityAdminPage() {
  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-header__title">Activity Log</h1>
        <p className="admin-page-header__desc">
          Track admin actions across the system
        </p>
      </div>

      <section className="admin-card" aria-labelledby="log-heading">
        <div className="admin-card__header">
          <h2 id="log-heading" className="admin-card__title">
            Recent Actions
          </h2>
        </div>
        <ActivityLog />
      </section>
    </>
  )
}
