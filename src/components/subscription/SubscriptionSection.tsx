"use client"

import { useEffect, useState } from "react"
import styles from "./SubscriptionSection.module.scss"

type SubscriptionPayload = {
  status: string
  planKey: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  manageBillingUrl: string | null
  portalTimedOut: boolean
}

function StatusChip({ status }: { status: string }) {
  return <span className={styles.chip}>{status.replaceAll("_", " ")}</span>
}

export function SubscriptionSection() {
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<SubscriptionPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/paddle/subscription")
        const data = (await res.json()) as {
          subscription: SubscriptionPayload | null
        }
        if (!cancelled) {
          setSub(data.subscription ?? null)
        }
      } catch {
        if (!cancelled) setSub(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="settings__panel">
        <div className="settings__section">
          <h2>Subscription</h2>
          <p className={styles.loading}>Loading billing status…</p>
        </div>
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="settings__panel">
        <div className="settings__section">
          <h2>Subscription</h2>
          <p className={styles.empty}>
            You do not have an active Superfan subscription yet.{" "}
            <a href="/pricing">View pricing</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings__panel">
      <div className="settings__section">
        <h2>Subscription</h2>
        <p className="settings__hint settings__hint--block">
          Superfan billing is processed securely by Paddle (merchant of record).
        </p>
        <div className={styles.row}>
          <span>Status:</span>
          <StatusChip status={sub.status} />
        </div>
        {sub.planKey ? (
          <p className={styles.meta}>
            Plan: {sub.planKey.replaceAll("_", " ")}
          </p>
        ) : null}
        {sub.trialEndsAt ? (
          <p className={styles.meta}>
            Trial ends: {new Date(sub.trialEndsAt).toLocaleDateString()}
          </p>
        ) : null}
        {sub.currentPeriodEnd ? (
          <p className={styles.meta}>
            Current period ends:{" "}
            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </p>
        ) : null}
        {sub.manageBillingUrl ? (
          <a
            className={styles.link}
            href={sub.manageBillingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Manage billing
          </a>
        ) : (
          <span
            className={`${styles.link} ${styles.linkDisabled}`}
            title={
              sub.portalTimedOut
                ? "Billing portal is temporarily unavailable. Try again later."
                : "Manage billing is only available for recurring subscriptions."
            }
          >
            Manage billing
          </span>
        )}
      </div>
    </div>
  )
}
