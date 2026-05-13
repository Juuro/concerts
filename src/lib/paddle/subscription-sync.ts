import type { Subscription as PaddleSubscription } from "@paddle/paddle-node-sdk"
import { prisma } from "@/lib/prisma"
import { listCustomerSubscriptions } from "./client"
import { syncSubscriptionFromPaddleData } from "./webhook-handler"

/** Shape expected by `syncSubscriptionFromPaddleData` (matches webhook payloads). */
export function paddleSubscriptionRemoteToSyncData(
  remote: PaddleSubscription
): unknown {
  return {
    id: remote.id,
    status: remote.status,
    customer_id: remote.customerId,
    custom_data: remote.customData,
    current_billing_period: remote.currentBillingPeriod
      ? {
          starts_at: remote.currentBillingPeriod.startsAt,
          ends_at: remote.currentBillingPeriod.endsAt,
        }
      : null,
    next_billed_at: remote.nextBilledAt,
    canceled_at: remote.canceledAt,
    items: remote.items.map((it) => ({
      recurring: it.recurring,
      price_id: it.price?.id,
      price: it.price ? { id: it.price.id } : null,
      trial_dates: it.trialDates
        ? {
            starts_at: it.trialDates.startsAt,
            ends_at: it.trialDates.endsAt,
          }
        : null,
    })),
  }
}

function subscriptionStatusPriority(status: string): number {
  switch (status) {
    case "active":
      return 0
    case "trialing":
      return 1
    case "past_due":
      return 2
    case "paused":
      return 3
    case "canceled":
      return 4
    default:
      return 5
  }
}

function pickPrimarySubscription(
  subs: PaddleSubscription[]
): PaddleSubscription | null {
  if (subs.length === 0) return null
  return [...subs].sort(
    (a, b) =>
      subscriptionStatusPriority(a.status) -
      subscriptionStatusPriority(b.status)
  )[0]!
}

/**
 * When webhooks never reached this deployment (common on localhost), the user
 * can still have `paddleCustomerId` and an active subscription in Paddle.
 * Pull the best matching subscription and upsert local `Subscription` rows.
 */
export async function trySyncSubscriptionFromPaddleApi(
  userId: string,
  customerId: string
): Promise<boolean> {
  const remotes = await listCustomerSubscriptions(customerId)
  const best = pickPrimarySubscription(remotes)
  if (!best) return false
  try {
    await syncSubscriptionFromPaddleData(
      paddleSubscriptionRemoteToSyncData(best)
    )
    return true
  } catch {
    return false
  }
}

/**
 * Hydrate from the Paddle API when webhooks did not populate local rows, or
 * when a row exists but `planKey` is still empty (older syncs skipped items
 * without `recurring: true`).
 */
export async function ensureSubscriptionSyncedFromPaddle(
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      paddleCustomerId: true,
      subscription: {
        select: { id: true, planKey: true, paddleSubscriptionId: true },
      },
    },
  })
  if (!user?.paddleCustomerId) return

  const sub = user.subscription
  if (!sub) {
    await trySyncSubscriptionFromPaddleApi(userId, user.paddleCustomerId)
    return
  }
  if (!sub.planKey && sub.paddleSubscriptionId) {
    await trySyncSubscriptionFromPaddleApi(userId, user.paddleCustomerId)
  }
}
