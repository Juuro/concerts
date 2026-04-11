import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import AdminSidebar from "./components/AdminSidebar"
import "./admin.scss"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession(await headers())

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "admin") {
    redirect("/")
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-shell__content">{children}</div>
    </div>
  )
}
