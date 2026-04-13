import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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

  const feedbackNewCount = await prisma.appFeedback.count({
    where: { triageStatus: "NEW" },
  })

  return (
    <div className="admin-shell">
      <AdminSidebar feedbackNewCount={feedbackNewCount} />
      <div className="admin-shell__content">
        <div className="admin-subpage">{children}</div>
      </div>
    </div>
  )
}
