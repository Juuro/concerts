"use client"

import type { PaddlePlanKey } from "@/lib/paddle/config"
import { PaddleCheckoutButton } from "@/components/checkout/PaddleCheckoutButton"
import styles from "./PricingCard.module.scss"

interface PricingCardProps {
  title: string
  description: string
  priceLabel: string
  planKey: PaddlePlanKey
  currencyHint?: string
  localeDe: boolean
  paywallEnabled: boolean
  /** Logged-in user already has this plan with premium access (synced from Paddle). */
  isCurrentPlan?: boolean
}

export function PricingCard({
  title,
  description,
  priceLabel,
  planKey,
  currencyHint,
  localeDe,
  paywallEnabled,
  isCurrentPlan = false,
}: PricingCardProps) {
  const vatText = localeDe
    ? "Preise zzgl. MwSt.; der finale Betrag wird beim Checkout angezeigt."
    : "Prices exclude VAT; the final amount is shown at checkout."

  return (
    <article className={styles.card}>
      {isCurrentPlan ? (
        <p className={styles.currentPlan} role="status">
          {localeDe ? "Dein aktueller Plan" : "Your current plan"}
        </p>
      ) : null}
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.price}>
        {priceLabel}
        {currencyHint ? (
          <span className={styles.vatHint} title={vatText}>
            {" "}
            ({currencyHint})
          </span>
        ) : null}
      </p>
      <p className={styles.description}>{description}</p>
      <p className={styles.vat}>
        <span title={vatText}>{localeDe ? "zzgl. MwSt." : "excl. VAT"}</span>
      </p>
      <PaddleCheckoutButton
        planKey={planKey}
        label="Subscribe"
        paywallEnabled={paywallEnabled}
      />
    </article>
  )
}
