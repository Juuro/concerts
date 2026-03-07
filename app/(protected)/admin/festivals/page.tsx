import { Metadata } from "next"
import FestivalManagement from "../components/FestivalManagement"

export const metadata: Metadata = {
  title: "Festival Management | Admin",
  description: "Manage festivals and clean up orphaned entries",
}

export const dynamic = "force-dynamic"

export default function FestivalsAdminPage() {
  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-header__title">Festival Management</h1>
        <p className="admin-page-header__desc">
          Clean up orphaned festivals with no concerts
        </p>
      </div>

      <section className="admin-card" aria-labelledby="festivals-heading">
        <div className="admin-card__header">
          <h2 id="festivals-heading" className="admin-card__title">
            Orphaned Festivals
          </h2>
        </div>
        <FestivalManagement />
      </section>
    </>
  )
}
