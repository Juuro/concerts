import { SubscriptionStatus } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getCustomerPortalSessionUrl } from "./client"
import { getPlanForPriceId, tryGetPaddleEnvConfig } from "./config"
import { ensureSubscriptionSyncedFromPaddle } from "./subscription-sync"

const SUPERFAN_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PAUSED,
  SubscriptionStatus.LIFETIME,
]

export async function isUserSuperfan(userId: string): Promise<boolean> {
  await ensureSubscriptionSyncedFromPaddle(userId)
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  })
  if (!sub) return false
  return SUPERFAN_STATUSES.includes(sub.status)
}

export type SubscriptionSummary = {
  status: SubscriptionStatus
  planKey: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  manageBillingUrl: string | null
  portalTimedOut: boolean
}

const PORTAL_TIMEOUT_MS = 3000

/** Lightweight billing state for public pages (no Paddle portal session). */
export async function getPricingBillingHint(userId: string): Promise<{
  planKey: string | null
  isPremium: boolean
} | null> {
  await ensureSubscriptionSyncedFromPaddle(userId)
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { planKey: true, status: true, paddlePriceId: true },
  })
  if (!sub) return null
  let planKey = sub.planKey
  if (!planKey && sub.paddlePriceId) {
    const cfg = tryGetPaddleEnvConfig()
    if (cfg) {
      const mapped = getPlanForPriceId(sub.paddlePriceId)
      planKey = mapped ?? null
    }
  }
  return {
    planKey,
    isPremium: SUPERFAN_STATUSES.includes(sub.status),
  }
}

export async function getSubscriptionSummary(
  userId: string,
  options?: { includePortalSession?: boolean }
): Promise<SubscriptionSummary | null> {
  await ensureSubscriptionSyncedFromPaddle(userId)
  const includePortal = options?.includePortalSession !== false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  })
  if (!user?.subscription) return null

  const sub = user.subscription
  let manageBillingUrl: string | null = null
  let portalTimedOut = false

  if (
    includePortal &&
    user.paddleCustomerId &&
    sub.paddleSubscriptionId &&
    sub.status !== SubscriptionStatus.LIFETIME
  ) {
    try {
      manageBillingUrl = await getCustomerPortalSessionUrl(
        user.paddleCustomerId,
        [sub.paddleSubscriptionId],
        PORTAL_TIMEOUT_MS
      )
      if (!manageBillingUrl) portalTimedOut = true
    } catch {
      portalTimedOut = true
      manageBillingUrl = null
    }
  }

  return {
    status: sub.status,
    planKey: sub.planKey,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    manageBillingUrl,
    portalTimedOut,
  }
}
