"use client"

import type { PaddlePlanKey } from "@/lib/paddle/config"
import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { PricingCard } from "@/components/pricing/PricingCard"
import { useToast } from "@/components/Toast/Toast"

function PricingToastListener() {
  const params = useSearchParams()
  const { showToast } = useToast()

  useEffect(() => {
    if (params.get("success") === "1") {
      showToast({
        type: "success",
        message: "Thanks — your checkout completed successfully.",
      })
    }
    if (params.get("cancelled") === "1") {
      showToast({
        type: "info",
        message: "Checkout was cancelled.",
      })
    }
  }, [params, showToast])

  return null
}

export function PricingView({
  localeDe,
  paywallEnabled,
  billing,
  priceLabels,
}: {
  localeDe: boolean
  paywallEnabled: boolean
  billing: { planKey: string | null; isPremium: boolean } | null
  priceLabels: Partial<Record<PaddlePlanKey, string>>
}) {
  const fallback = (_plan: PaddlePlanKey) =>
    localeDe
      ? "Betrag aus deinem Paddle-Katalog (siehe Umgebungsvariablen)"
      : "Amount from your Paddle catalog (set price ID env vars)"

  return (
    <>
      <Suspense fallback={null}>
        <PricingToastListener />
      </Suspense>
      <h1>Superfan pricing</h1>
      <p className="pricing-page__intro">
        Support Concertivity and unlock premium capabilities. Billing is handled
        by Paddle as merchant of record (taxes and invoices where applicable).
      </p>
      {!paywallEnabled ? (
        <p className="pricing-page__notice" role="status">
          Paid plans are not enabled in this deployment yet (
          <code>ENABLE_PAYWALL</code>).
        </p>
      ) : null}
      <div className="pricing-page__grid">
        <PricingCard
          title="Superfan — Monthly"
          description="Flexible monthly access to Superfan features."
          priceLabel={priceLabels.monthly ?? fallback("monthly")}
          planKey="monthly"
          currencyHint={priceLabels.monthly ? undefined : "EUR"}
          localeDe={localeDe}
          paywallEnabled={paywallEnabled}
          isCurrentPlan={
            Boolean(billing?.isPremium) && billing?.planKey === "monthly"
          }
        />
        <PricingCard
          title="Superfan — Yearly"
          description="Best value for long-time gig-goers."
          priceLabel={priceLabels.yearly ?? fallback("yearly")}
          planKey="yearly"
          currencyHint={priceLabels.yearly ? undefined : "EUR"}
          localeDe={localeDe}
          paywallEnabled={paywallEnabled}
          isCurrentPlan={
            Boolean(billing?.isPremium) && billing?.planKey === "yearly"
          }
        />
        <PricingCard
          title="Lifetime beta"
          description="Limited-time one-time purchase while seats last."
          priceLabel={priceLabels.lifetime_beta ?? fallback("lifetime_beta")}
          planKey="lifetime_beta"
          currencyHint={priceLabels.lifetime_beta ? undefined : "EUR"}
          localeDe={localeDe}
          paywallEnabled={paywallEnabled}
          isCurrentPlan={
            Boolean(billing?.isPremium) && billing?.planKey === "lifetime_beta"
          }
        />
      </div>
    </>
  )
}
