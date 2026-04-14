import { getAttentionStats } from "@/lib/admin"
import AdminAttentionClient from "./AdminAttentionClient"

export type { AttentionStats } from "@/lib/admin"

export default async function AdminAttention() {
  const initialStats = await getAttentionStats()
  return <AdminAttentionClient initialStats={initialStats} />
}
