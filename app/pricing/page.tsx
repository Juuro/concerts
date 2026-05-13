import { headers } from "next/headers"
import Layout from "@/components/layout-client"
import { auth } from "@/lib/auth"
import type { PaddlePlanKey } from "@/lib/paddle/config"
import { getPricingBillingHint } from "@/lib/paddle/entitlement"
import { getPlanPriceLabels } from "@/lib/paddle/price-previews"
import { FEATURE_FLAGS, isFeatureEnabled } from "@/utils/featureFlags"
import { PricingView } from "./PricingView"
import "./pricing.scss"

export default async function PricingPage() {
  const hdrs = await headers()
  const accept = hdrs.get("accept-language") ?? ""
  const localeDe = accept.toLowerCase().includes("de")
  const paywallEnabled = isFeatureEnabled(FEATURE_FLAGS.ENABLE_PAYWALL, false)

  const session = await auth.api.getSession({ headers: hdrs })
  let billing: { planKey: string | null; isPremium: boolean } | null = null
  if (session?.user) {
    try {
      billing = await getPricingBillingHint(session.user.id)
    } catch {
      billing = null
    }
  }

  const priceLocale = localeDe ? "de-DE" : "en-US"
  let priceLabels: Partial<Record<PaddlePlanKey, string>> = {}
  try {
    priceLabels = await getPlanPriceLabels(priceLocale)
  } catch {
    priceLabels = {}
  }

  return (
    <Layout>
      <main className="pricing-page">
        <PricingView
          localeDe={localeDe}
          paywallEnabled={paywallEnabled}
          billing={billing}
          priceLabels={priceLabels}
        />
      </main>
    </Layout>
  )
}
