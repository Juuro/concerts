"use client"

import { useState } from "react"
import "./bandEditForm.scss"

interface BandEditFormProps {
  band: {
    slug: string
    name: string
    websiteUrl?: string | null
  }
  canEditName?: boolean
  onSave?: (updatedBand: { name: string; websiteUrl?: string | null }) => void
  onCancel?: () => void
}

export default function BandEditForm({ band, canEditName = false, onSave, onCancel }: BandEditFormProps) {
  const [name, setName] = useState(band.name)
  const [websiteUrl, setWebsiteUrl] = useState(band.websiteUrl || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        websiteUrl: websiteUrl || null,
      }

      // Only include name if user has permission to edit it
      if (canEditName) {
        body.name = name
      }

      const res = await fetch(`/api/bands/${band.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const updated = await res.json()
        onSave?.({
          name: updated.name,
          websiteUrl: updated.websiteUrl,
        })
      } else {
        const data = await res.json()
        setError(data.error || "Failed to update band")
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="band-edit-form">
      <form onSubmit={handleSubmit}>
        {error && <div className="band-edit-form__error">{error}</div>}

        <div className="band-edit-form__field">
          <label htmlFor={`band-name-${band.slug}`}>Name</label>
          <input
            type="text"
            id={`band-name-${band.slug}`}
            value={name}
            onChange={(e) => canEditName && setName(e.target.value)}
            readOnly={!canEditName}
            required
          />
          {!canEditName && (
            <p className="band-edit-form__hint">Only admins can edit band names</p>
          )}
        </div>

        <div className="band-edit-form__field">
          <label htmlFor={`band-website-${band.slug}`}>Website URL</label>
          <input
            type="url"
            id={`band-website-${band.slug}`}
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="band-edit-form__actions">
          <button
            type="button"
            className="band-edit-form__cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="band-edit-form__save"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
