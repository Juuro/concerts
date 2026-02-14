"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import BandEditForm from "@/components/BandEditForm/BandEditForm"
import Dialog from "@/components/Dialog/Dialog"
import styles from "./page.module.scss"

interface BandEditToggleProps {
  band: {
    slug: string
    name: string
    imageUrl?: string
    websiteUrl?: string
  }
}

export default function BandEditToggle({ band }: BandEditToggleProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        className={styles.editIcon}
        onClick={() => setOpen(true)}
        aria-label="Edit band"
        title="Edit band"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path
            d="M16.474 5.408l2.118 2.118m-.756-3.982L12.109 9.27a2.118 2.118 0 00-.58 1.082L11 13l2.648-.53a2.118 2.118 0 001.082-.58l5.727-5.727a1.853 1.853 0 10-2.621-2.621z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 15v3a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit Band">
        <BandEditForm
          band={band}
          onSave={() => {
            setOpen(false)
            router.refresh()
          }}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  )
}
