"use client"

import { useCallback, useId, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Dialog from "@/components/Dialog/Dialog"
import { useToast } from "@/components/Toast/Toast"
import styles from "./FeedbackModal.module.scss"

type Category = "BUG" | "FEATURE" | "GENERAL"

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "BUG", label: "Bug report" },
  { value: "FEATURE", label: "Feature request" },
  { value: "GENERAL", label: "General feedback" },
]

export default function FeedbackModal() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>("GENERAL")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const pathname = usePathname()
  const { showToast } = useToast()
  const formId = useId()
  const categoryId = `${formId}-category`
  const messageId = `${formId}-message`

  const resetForm = useCallback(() => {
    setCategory("GENERAL")
    setMessage("")
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    resetForm()
  }, [resetForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          category,
          message: message.trim(),
          pagePath: pathname && pathname.length > 0 ? pathname : undefined,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
      }

      if (!res.ok) {
        showToast({
          message: data.error || "Could not send feedback.",
          type: "error",
        })
        return
      }

      showToast({
        message: "Thank you — your feedback was sent.",
        type: "success",
      })
      handleClose()
    } catch {
      showToast({
        message: "Network error. Please try again.",
        type: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Feedback
      </button>

      <Dialog open={open} onClose={handleClose} title="Send feedback">
        <form className={styles.form} onSubmit={handleSubmit}>
          <p className={styles.hint} id={`${formId}-desc`}>
            Tell us about a bug, an idea, or anything else. We store your
            category, message, the page you are on (if you allow it), and
            technical details from your browser (such as user agent) to
            reproduce issues. If you are signed in, we link this to your account
            to help follow up. See our{" "}
            <Link href="/privacy" className={styles.privacyLink}>
              Privacy Policy
            </Link>{" "}
            for how we handle personal data.
          </p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={categoryId}>
              Type
            </label>
            <select
              id={categoryId}
              className={styles.select}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              aria-describedby={`${formId}-desc`}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={messageId}>
              Message
            </label>
            <textarea
              id={messageId}
              className={styles.textarea}
              value={message}
              onChange={(e) => {
                const nextMessage = e.target.value
                e.target.setCustomValidity(
                  nextMessage.trim().length >= 10
                    ? ""
                    : "Message must contain at least 10 non-whitespace characters."
                )
                setMessage(nextMessage)
              }}
              onInvalid={(e) => {
                e.currentTarget.setCustomValidity(
                  e.currentTarget.value.trim().length >= 10
                    ? ""
                    : "Message must contain at least 10 non-whitespace characters."
                )
              }}
              rows={5}
              required
              minLength={10}
              maxLength={5000}
              placeholder="Describe what happened or what you would like…"
              aria-describedby={`${formId}-desc ${messageId}-validation`}
              aria-invalid={message.length > 0 && message.trim().length < 10}
            />
            <span
              id={`${messageId}-validation`}
              className={styles.validation}
              aria-live="polite"
            >
              {message.length > 0 && message.trim().length < 10
                ? "Message must contain at least 10 non-whitespace characters."
                : ""}
            </span>
            <span className={styles.counter} aria-live="polite">
              {message.length} / 5000
            </span>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.buttonPrimary}
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
