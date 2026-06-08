import { z } from "zod"

const paddleEnvSchema = z.enum(["sandbox", "production"])

const configSchema = z.object({
  paddleApiKey: z.string().min(1),
  paddleWebhookSecret: z.string().min(1),
  paddleEnvironment: z.preprocess((v) => {
    const s = typeof v === "string" ? v.trim().toLowerCase() : "sandbox"
    if (s === "production" || s === "prod") return "production"
    return "sandbox"
  }, paddleEnvSchema),
  priceIdMonthly: z.string().min(1),
  priceIdYearly: z.string().min(1),
  priceIdLifetimeBeta: z.string().min(1),
  lifetimeOfferDeadline: z.coerce.date().optional(),
  lifetimeOfferSeatCap: z.coerce.number().int().positive().optional(),
})

export type PaddlePlanKey = "monthly" | "yearly" | "lifetime_beta"

export type PaddleEnvConfig = z.infer<typeof configSchema>

let cached: PaddleEnvConfig | null = null
let cachedInvalid: Error | null = null

function readConfig(): PaddleEnvConfig {
  const raw = {
    paddleApiKey: process.env.PADDLE_API_KEY?.trim() ?? "",
    paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET?.trim() ?? "",
    paddleEnvironment: process.env.PADDLE_ENVIRONMENT,
    priceIdMonthly: process.env.PADDLE_PRICE_ID_MONTHLY?.trim() ?? "",
    priceIdYearly: process.env.PADDLE_PRICE_ID_YEARLY?.trim() ?? "",
    priceIdLifetimeBeta:
      process.env.PADDLE_PRICE_ID_LIFETIME_BETA?.trim() ?? "",
    lifetimeOfferDeadline:
      process.env.LIFETIME_OFFER_DEADLINE?.trim() || undefined,
    lifetimeOfferSeatCap:
      process.env.LIFETIME_OFFER_SEAT_CAP?.trim() || undefined,
  }

  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ")
    throw new Error(`Invalid Paddle configuration: ${msg}`)
  }
  return parsed.data
}

/**
 * Validated Paddle env (throws if misconfigured). Call only when Paddle routes are active.
 */
export function getPaddleEnvConfig(): PaddleEnvConfig {
  if (cachedInvalid) throw cachedInvalid
  if (cached) return cached
  try {
    cached = readConfig()
    return cached
  } catch (e) {
    cachedInvalid = e instanceof Error ? e : new Error(String(e))
    throw cachedInvalid
  }
}

export function tryGetPaddleEnvConfig(): PaddleEnvConfig | null {
  try {
    return getPaddleEnvConfig()
  } catch {
    return null
  }
}

export function resetPaddleConfigCacheForTests(): void {
  cached = null
  cachedInvalid = null
}

export function getPriceIdForPlan(plan: PaddlePlanKey): string {
  const c = getPaddleEnvConfig()
  switch (plan) {
    case "monthly":
      return c.priceIdMonthly
    case "yearly":
      return c.priceIdYearly
    case "lifetime_beta":
      return c.priceIdLifetimeBeta
    default: {
      const _exhaustive: never = plan
      return _exhaustive
    }
  }
}

export function getPlanForPriceId(
  priceId: string | undefined | null
): PaddlePlanKey | null {
  if (!priceId) return null
  const c = getPaddleEnvConfig()
  if (priceId === c.priceIdMonthly) return "monthly"
  if (priceId === c.priceIdYearly) return "yearly"
  if (priceId === c.priceIdLifetimeBeta) return "lifetime_beta"
  return null
}

export function isLifetimeOfferOpen(now = new Date()): boolean {
  let cfg: PaddleEnvConfig
  try {
    cfg = getPaddleEnvConfig()
  } catch {
    return false
  }
  if (cfg.lifetimeOfferDeadline && now > cfg.lifetimeOfferDeadline) {
    return false
  }
  return true
}
