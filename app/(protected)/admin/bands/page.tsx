import { Metadata } from "next"
import BandManagement from "../components/BandManagement"
import BandMerge from "../components/BandMerge"

export const metadata: Metadata = {
  title: "Band Management | Admin",
  description: "Manage bands, enrich data, and merge duplicates",
}

export default function BandsAdminPage() {
  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-header__title">Band Management</h1>
        <p className="admin-page-header__desc">
          Enrich missing data, clean up orphaned bands, and merge duplicates
        </p>
      </div>

      <div className="admin-bands-layout">
        <section className="admin-card" aria-labelledby="bands-heading">
          <div className="admin-card__header">
            <h2 id="bands-heading" className="admin-card__title">
              Data Quality
            </h2>
          </div>
          <BandManagement />
        </section>

        <section className="admin-card" aria-labelledby="merge-heading">
          <div className="admin-card__header">
            <h2 id="merge-heading" className="admin-card__title">
              Merge Duplicates
            </h2>
          </div>
          <BandMerge />
        </section>
      </div>
    </>
  )
}
