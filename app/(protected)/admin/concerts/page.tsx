import { Metadata } from "next"
import ConcertManagement from "../components/ConcertManagement"

export const metadata: Metadata = {
  title: "Concert Management | Admin",
  description: "Manage concert data quality and geocoding",
}

export default function ConcertsAdminPage() {
  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-header__title">Concert Data Quality</h1>
        <p className="admin-page-header__desc">
          Fix concerts missing city data via geocoding
        </p>
      </div>

      <section className="admin-card" aria-labelledby="concerts-heading">
        <div className="admin-card__header">
          <h2 id="concerts-heading" className="admin-card__title">
            Missing Geocoding
          </h2>
        </div>
        <ConcertManagement />
      </section>
    </>
  )
}
