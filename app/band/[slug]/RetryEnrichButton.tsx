"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import styles from "./page.module.scss"

interface RetryEnrichButtonProps {
  slug: string
}

export default function RetryEnrichButton({ slug }: RetryEnrichButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRetry() {
    setLoading(true)
    try {
      await fetch(`/api/bands/${slug}/enrich`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={styles.retryIcon}
      onClick={handleRetry}
      disabled={loading}
      aria-label="Retry fetching band image"
      title="Retry fetching band image"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className={loading ? styles.spinning : undefined}
      >
        <path
          d="M4 12a8 8 0 018-8V2l4 3-4 3V6a6 6 0 100 12 6 6 0 004.9-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
