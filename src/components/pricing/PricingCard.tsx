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
  isCurrentPlan?: boolean
  highlighted?: boolean
  badge?: string
  billingPeriod?: string
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
  highlighted = false,
  badge,
  billingPeriod,
}: PricingCardProps) {
  const vatText = localeDe
    ? "Preise zzgl. MwSt.; der finale Betrag wird beim Checkout angezeigt."
    : "Prices exclude VAT; the final amount is shown at checkout."

  const cardClass = [styles.card, highlighted ? styles.cardHighlighted : ""]
    .filter(Boolean)
    .join(" ")

  return (
    <article className={cardClass}>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      {isCurrentPlan ? (
        <p className={styles.currentPlan} role="status">
          {localeDe ? "Dein aktueller Plan" : "Your current plan"}
        </p>
      ) : null}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.price}>
        <span className={styles.priceAmount}>{priceLabel}</span>
        {billingPeriod ? (
          <span className={styles.pricePeriod}>{billingPeriod}</span>
        ) : null}
        {currencyHint ? (
          <span className={styles.vatHint} title={vatText}>
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
        label={localeDe ? "Jetzt abonnieren" : "Subscribe"}
        paywallEnabled={paywallEnabled}
        variant={highlighted ? "primary" : "secondary"}
        className={styles.checkoutButton}
      />
    </article>
  )
}
