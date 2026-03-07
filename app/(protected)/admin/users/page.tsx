import { Metadata } from "next"
import UserManagement from "../components/UserManagement"

export const metadata: Metadata = {
  title: "User Management | Admin",
  description: "View users and manage account bans",
}

export const dynamic = "force-dynamic"

export default function UsersAdminPage() {
  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-header__title">User Management</h1>
        <p className="admin-page-header__desc">
          View users and manage account bans
        </p>
      </div>

      <section className="admin-card" aria-labelledby="users-heading">
        <div className="admin-card__header">
          <h2 id="users-heading" className="admin-card__title">
            All Users
          </h2>
        </div>
        <UserManagement />
      </section>
    </>
  )
}
