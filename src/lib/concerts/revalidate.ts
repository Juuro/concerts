import { revalidateTag } from "next/cache"

/**
 * Invalidate every cache tag affected by a concert create/update/delete for a
 * user. Must stay in sync with all concert mutation entry points so statistics
 * and dashboard counts never go stale (see CLAUDE.md "Caching / Revalidation").
 */
export function revalidateConcertCaches(userId: string): void {
  revalidateTag("concert-statistics", "max")
  revalidateTag("user-concert-statistics", "max")
  revalidateTag(`user-concert-counts-${userId}`, "max")
  revalidateTag(`user-dashboard-counts-${userId}`, "max")
  revalidateTag(`user-unique-bands-${userId}`, "max")
  revalidateTag(`user-total-spent-${userId}`, "max")
}
