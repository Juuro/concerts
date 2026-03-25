"use client"

import { useState, useEffect, useRef, useCallback, Fragment } from "react"
import type { BandSearchResultItem } from "@/types/bandSearch"
import { normalizeBandSearchKey } from "@/utils/bandSearchNormalize"
import "./bandAutocomplete.scss"

interface Band {
  id: string
  name: string
  slug: string
}

export interface SelectedBand {
  bandId: string
  name: string
  slug: string
  isHeadliner: boolean
}

interface BandAutocompleteProps {
  selectedBands: SelectedBand[]
  onBandsChange: (bands: SelectedBand[]) => void
  onCreateBand?: (name: string) => Promise<void>
  disabled?: boolean
  isAdmin?: boolean
  onEditBand?: (slug: string) => void
}

export default function BandAutocomplete({
  selectedBands,
  onBandsChange,
  onCreateBand,
  disabled = false,
  isAdmin = false,
  onEditBand,
}: BandAutocompleteProps) {
  // Autocomplete state
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<BandSearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Chip navigation state
  const [focusedChipIndex, setFocusedChipIndex] = useState(-1)
  const [grabbedChipIndex, setGrabbedChipIndex] = useState<number | null>(null)
  const [originalOrderBeforeGrab, setOriginalOrderBeforeGrab] = useState<SelectedBand[] | null>(null)

  // Drag state for pointer events
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ index: number; side: "before" | "after" } | null>(null)

  // Announcement for screen readers
  const [announcement, setAnnouncement] = useState("")

  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const chipsContainerRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Debounced band search
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(
          `/api/bands/search?q=${encodeURIComponent(searchTerm)}`
        )
        if (res.ok) {
          const data = (await res.json()) as BandSearchResultItem[]
          const filtered = data.filter((row) => {
            if (row.kind === "db") {
              return !selectedBands.some((sb) => sb.bandId === row.id)
            }
            const key = normalizeBandSearchKey(row.name)
            return !selectedBands.some(
              (sb) => normalizeBandSearchKey(sb.name) === key
            )
          })
          setSearchResults(filtered)
          setIsOpen(filtered.length > 0 || searchTerm.length >= 2)
        }
      } catch (err) {
        console.error("Band search error:", err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, selectedBands])

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchResults])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Announce function for screen readers
  const announce = useCallback((message: string) => {
    setAnnouncement("")
    // Small delay to ensure the region updates
    setTimeout(() => setAnnouncement(message), 50)
  }, [])

  // Add an existing DB band to selection
  const handleAddBand = useCallback(
    (band: Band) => {
      if (selectedBands.some((b) => b.bandId === band.id)) return

      const newBand: SelectedBand = {
        bandId: band.id,
        name: band.name,
        slug: band.slug,
        isHeadliner: selectedBands.length === 0, // First band is headliner by default
      }

      onBandsChange([...selectedBands, newBand])
      setSearchTerm("")
      setSearchResults([])
      setIsOpen(false)
      setHighlightedIndex(-1)
      inputRef.current?.focus()
    },
    [selectedBands, onBandsChange]
  )

  /** External catalog row: create band (same flow as typing a new name). */
  const handleSelectSuggestion = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed || !onCreateBand) return
      if (
        selectedBands.some(
          (sb) => normalizeBandSearchKey(sb.name) === normalizeBandSearchKey(trimmed)
        )
      ) {
        return
      }
      setSearchTerm("")
      setSearchResults([])
      setIsOpen(false)
      setHighlightedIndex(-1)
      await onCreateBand(trimmed)
      inputRef.current?.focus()
    },
    [selectedBands, onCreateBand]
  )

  // Remove a band from selection
  const handleRemoveBand = useCallback(
    (bandId: string, index: number) => {
      const band = selectedBands.find((b) => b.bandId === bandId)
      onBandsChange(selectedBands.filter((b) => b.bandId !== bandId))
      announce(`${band?.name || "Band"} removed`)

      // Focus management after removal
      if (selectedBands.length <= 1) {
        inputRef.current?.focus()
        setFocusedChipIndex(-1)
      } else if (index >= selectedBands.length - 1) {
        setFocusedChipIndex(selectedBands.length - 2)
      } else {
        setFocusedChipIndex(index)
      }
    },
    [selectedBands, onBandsChange, announce]
  )

  // Toggle headliner status and auto-sort (headliners first)
  const handleToggleHeadliner = useCallback(
    (bandId: string) => {
      const band = selectedBands.find((b) => b.bandId === bandId)
      const newStatus = !band?.isHeadliner

      // Update the band's headliner status
      const updatedBands = selectedBands.map((b) =>
        b.bandId === bandId ? { ...b, isHeadliner: newStatus } : b
      )

      // Sort: headliners first (preserve relative order within each group)
      const headliners = updatedBands.filter((b) => b.isHeadliner)
      const nonHeadliners = updatedBands.filter((b) => !b.isHeadliner)

      onBandsChange([...headliners, ...nonHeadliners])

      announce(
        newStatus
          ? `${band?.name} marked as headliner and moved to front`
          : `${band?.name} removed as headliner`
      )
    },
    [selectedBands, onBandsChange, announce]
  )

  // Reorder bands (only within same headliner group)
  const reorderBands = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return

      const movingBand = selectedBands[fromIndex]
      const targetBand = selectedBands[toIndex]

      // Only allow reordering within the same group (headliner or non-headliner)
      if (movingBand.isHeadliner !== targetBand.isHeadliner) return

      const newBands = [...selectedBands]
      const [movedBand] = newBands.splice(fromIndex, 1)
      newBands.splice(toIndex, 0, movedBand)
      onBandsChange(newBands)
    },
    [selectedBands, onBandsChange]
  )

  // Keyboard handler for dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    // If no results and not searching, allow creating band with Enter
    if (searchTerm.length >= 2 && searchResults.length === 0 && !isSearching) {
      if (e.key === "Enter" && onCreateBand) {
        e.preventDefault()
        onCreateBand(searchTerm)
        setSearchTerm("")
        return
      }
    }

    // Navigate to chips with left arrow when at start of input
    if (
      e.key === "ArrowLeft" &&
      inputRef.current?.selectionStart === 0 &&
      selectedBands.length > 0
    ) {
      e.preventDefault()
      setFocusedChipIndex(selectedBands.length - 1)
      return
    }

    if (!isOpen || searchResults.length === 0) {
      if (e.key === "Escape") {
        setSearchTerm("")
        setSearchResults([])
        setIsOpen(false)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          const row = searchResults[highlightedIndex]
          if (row.kind === "db") {
            handleAddBand({
              id: row.id,
              name: row.name,
              slug: row.slug,
            })
          } else {
            void handleSelectSuggestion(row.name)
          }
        }
        break
      case "Escape":
        e.preventDefault()
        setSearchTerm("")
        setSearchResults([])
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case "Tab":
        setIsOpen(false)
        setSearchResults([])
        setHighlightedIndex(-1)
        break
    }
  }

  // Keyboard handler for chips (roving tabindex)
  const handleChipKeyDown = (e: React.KeyboardEvent, index: number) => {
    const band = selectedBands[index]

    // If chip is grabbed for reordering
    if (grabbedChipIndex !== null) {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          if (grabbedChipIndex > 0) {
            reorderBands(grabbedChipIndex, grabbedChipIndex - 1)
            setGrabbedChipIndex(grabbedChipIndex - 1)
            setFocusedChipIndex(grabbedChipIndex - 1)
            announce(
              `${band.name} moved to position ${grabbedChipIndex} of ${selectedBands.length}`
            )
          }
          break
        case "ArrowRight":
          e.preventDefault()
          if (grabbedChipIndex < selectedBands.length - 1) {
            reorderBands(grabbedChipIndex, grabbedChipIndex + 1)
            setGrabbedChipIndex(grabbedChipIndex + 1)
            setFocusedChipIndex(grabbedChipIndex + 1)
            announce(
              `${band.name} moved to position ${grabbedChipIndex + 2} of ${selectedBands.length}`
            )
          }
          break
        case " ":
          e.preventDefault()
          announce(
            `${band.name} dropped at position ${grabbedChipIndex + 1} of ${selectedBands.length}`
          )
          setGrabbedChipIndex(null)
          setOriginalOrderBeforeGrab(null)
          break
        case "Escape":
          e.preventDefault()
          // Restore original order
          if (originalOrderBeforeGrab) {
            onBandsChange(originalOrderBeforeGrab)
            const originalIndex = originalOrderBeforeGrab.findIndex(
              (b) => b.bandId === band.bandId
            )
            setFocusedChipIndex(originalIndex >= 0 ? originalIndex : index)
          }
          announce(`Reordering cancelled. ${band.name} returned to original position`)
          setGrabbedChipIndex(null)
          setOriginalOrderBeforeGrab(null)
          break
      }
      return
    }

    // Normal chip navigation
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault()
        if (index > 0) {
          setFocusedChipIndex(index - 1)
        }
        break
      case "ArrowRight":
        e.preventDefault()
        if (index < selectedBands.length - 1) {
          setFocusedChipIndex(index + 1)
        } else {
          // Move focus to input
          setFocusedChipIndex(-1)
          inputRef.current?.focus()
        }
        break
      case "Home":
        e.preventDefault()
        setFocusedChipIndex(0)
        break
      case "End":
        e.preventDefault()
        setFocusedChipIndex(selectedBands.length - 1)
        break
      case "Delete":
      case "Backspace":
        e.preventDefault()
        handleRemoveBand(band.bandId, index)
        break
      case "h":
      case "H":
        e.preventDefault()
        handleToggleHeadliner(band.bandId)
        break
      case " ":
        e.preventDefault()
        setOriginalOrderBeforeGrab([...selectedBands])
        setGrabbedChipIndex(index)
        announce(
          `${band.name} grabbed. Use Left and Right arrow keys to move. Press Space to drop or Escape to cancel.`
        )
        break
    }
  }

  // Focus chip when focusedChipIndex changes
  useEffect(() => {
    if (focusedChipIndex >= 0) {
      const chipEl = chipRefs.current.get(focusedChipIndex)
      chipEl?.focus()
    }
  }, [focusedChipIndex])

  // Pointer drag handlers
  const handleDragStart = (e: React.PointerEvent, index: number) => {
    // Only allow drag from handle
    const target = e.target as HTMLElement
    if (!target.closest(".band-chip__drag-handle")) return

    e.preventDefault()

    // Get chip's initial position to calculate offset
    const chipEl = chipRefs.current.get(index)
    if (chipEl) {
      const rect = chipEl.getBoundingClientRect()

      // Lock chip at its current viewport position before React inserts the ghost
      chipEl.style.animation = "none"
      chipEl.style.position = "fixed"
      chipEl.style.left = `${rect.left}px`
      chipEl.style.top = `${rect.top}px`
      chipEl.style.width = `${rect.width}px`

      dragStateRef.current = {
        startRect: rect,
        offset: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
        chipEl: chipEl,
      }
    }

    setDraggingIndex(index)
  }

  // Refs for drag state (avoid React re-renders during drag for performance)
  const dragStateRef = useRef<{
    startRect: DOMRect | null
    offset: { x: number; y: number } | null
    chipEl: HTMLDivElement | null
  }>({ startRect: null, offset: null, chipEl: null })

  // Use document-level listeners for drag to work reliably
  useEffect(() => {
    if (draggingIndex === null) return

    const handlePointerMove = (e: PointerEvent) => {
      const { startRect, offset, chipEl } = dragStateRef.current
      if (!startRect || !offset || !chipEl) return

      // Update chip transform directly on DOM for smooth dragging
      const translateX = e.clientX - offset.x - startRect.left
      const translateY = e.clientY - offset.y - startRect.top
      chipEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(1.05)`

      // Calculate drop target
      const container = chipsContainerRef.current
      if (!container) return

      const chips = Array.from(
        container.querySelectorAll(".band-chip:not(.band-chip--ghost):not(.band-chip--dragging)")
      )
      const mouseX = e.clientX
      const mouseY = e.clientY

      // Build candidate list: chips in the same headliner group with their rects
      const candidates: { index: number; rect: DOMRect }[] = []
      chips.forEach((chip, i) => {
        if (selectedBands[i]?.isHeadliner !== selectedBands[draggingIndex].isHeadliner) return
        candidates.push({ index: i, rect: chip.getBoundingClientRect() })
      })

      if (candidates.length === 0) {
        setDropTarget({ index: draggingIndex, side: "before" })
        return
      }

      // Group candidates by row (rounded top position)
      const rowMap = new Map<number, typeof candidates>()
      for (const c of candidates) {
        const rowTop = Math.round(c.rect.top)
        if (!rowMap.has(rowTop)) rowMap.set(rowTop, [])
        rowMap.get(rowTop)!.push(c)
      }
      const rows = Array.from(rowMap.entries()).sort(([a], [b]) => a - b)

      // Pick the row closest to cursor Y
      let closestRow = rows[0][1]
      let minRowDist = Infinity
      for (const [, rowCandidates] of rows) {
        const midY = rowCandidates[0].rect.top + rowCandidates[0].rect.height / 2
        const dist = Math.abs(mouseY - midY)
        if (dist < minRowDist) {
          minRowDist = dist
          closestRow = rowCandidates
        }
      }

      // Find insertion point on this row
      const lastOnRow = closestRow[closestRow.length - 1]
      const firstOnRow = closestRow[0]

      if (mouseX >= lastOnRow.rect.right) {
        // Cursor past the last chip on this row — drop after it
        setDropTarget({ index: lastOnRow.index, side: "after" })
      } else if (mouseX <= firstOnRow.rect.left) {
        // Cursor before the first chip on this row — drop before it
        setDropTarget({ index: firstOnRow.index, side: "before" })
      } else {
        // Cursor between chips — find which side of each center
        for (const c of closestRow) {
          const chipCenter = c.rect.left + c.rect.width / 2
          if (mouseX < chipCenter) {
            setDropTarget({ index: c.index, side: "before" })
            return
          }
        }
        // Past all centers — after the last one
        setDropTarget({ index: lastOnRow.index, side: "after" })
      }
    }

    const handlePointerUp = () => {
      // Reset chip styles
      const { chipEl: draggedChipEl } = dragStateRef.current
      if (draggedChipEl) {
        draggedChipEl.style.transform = ""
        draggedChipEl.style.animation = ""
        draggedChipEl.style.position = ""
        draggedChipEl.style.left = ""
        draggedChipEl.style.top = ""
        draggedChipEl.style.width = ""
      }
      dragStateRef.current = { startRect: null, offset: null, chipEl: null }
      setDraggingIndex(null)
      setDropTarget(null)
    }

    document.addEventListener("pointermove", handlePointerMove)
    document.addEventListener("pointerup", handlePointerUp)

    return () => {
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerup", handlePointerUp)
    }
  }, [draggingIndex, selectedBands])

  // Handle drop with reorder logic (called before state resets)
  const pendingDropRef = useRef<{ from: number; to: number } | null>(null)

  useEffect(() => {
    if (draggingIndex !== null && dropTarget !== null) {
      // Convert {index, side} to actual reorder target index
      const { index: chipIdx, side } = dropTarget
      let to: number
      if (side === "before") {
        to = draggingIndex < chipIdx ? chipIdx - 1 : chipIdx
      } else {
        to = draggingIndex > chipIdx ? chipIdx + 1 : chipIdx
      }
      pendingDropRef.current = { from: draggingIndex, to }
    }
  }, [draggingIndex, dropTarget])

  useEffect(() => {
    // When dragging ends (draggingIndex becomes null), perform the reorder
    if (draggingIndex === null && pendingDropRef.current) {
      const { from, to } = pendingDropRef.current
      if (from !== to) {
        reorderBands(from, to)
        announce(`${selectedBands[from]?.name} dropped at position ${to + 1}`)
      }
      pendingDropRef.current = null
    }
  }, [draggingIndex, reorderBands, announce, selectedBands])

  // Render predictive text with highlighting
  const renderPredictiveText = (bandName: string) => {
    const lowerSearch = searchTerm.toLowerCase()
    const lowerName = bandName.toLowerCase()
    const matchIndex = lowerName.indexOf(lowerSearch)

    if (matchIndex === -1) {
      // No direct match, just return the name
      return <span className="band-autocomplete__prediction">{bandName}</span>
    }

    const beforeMatch = bandName.slice(0, matchIndex)
    const match = bandName.slice(matchIndex, matchIndex + searchTerm.length)
    const afterMatch = bandName.slice(matchIndex + searchTerm.length)

    return (
      <>
        {beforeMatch && (
          <span className="band-autocomplete__prediction">{beforeMatch}</span>
        )}
        <span className="band-autocomplete__match">{match}</span>
        {afterMatch && (
          <span className="band-autocomplete__prediction">{afterMatch}</span>
        )}
      </>
    )
  }

  return (
    <div className="band-autocomplete">
      {/* Backdrop when dropdown is open */}
      {isOpen && <div className="band-autocomplete__backdrop" />}

      {/* Live region for screen reader announcements */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="band-autocomplete__live-region"
      >
        {announcement}
      </div>

      {/* Search input */}
      <div className="band-autocomplete__input-wrapper">
        <input
          ref={inputRef}
          type="text"
          id="bandSearch"
          role="combobox"
          aria-expanded={isOpen && searchResults.length > 0}
          aria-controls="band-listbox"
          aria-activedescendant={
            highlightedIndex >= 0 ? `band-option-${highlightedIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-label="Search or add bands"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setFocusedChipIndex(-1)}
          placeholder="Type to search bands..."
          disabled={disabled}
          autoComplete="off"
        />
        {isSearching && (
          <span className="band-autocomplete__searching">Searching...</span>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <ul
          ref={dropdownRef}
          className="band-autocomplete__dropdown"
          role="listbox"
          id="band-listbox"
          aria-label="Band search results"
        >
          {searchResults.length > 0 ? (
            searchResults.slice(0, 10).map((row, index) => {
              const key =
                row.kind === "db"
                  ? row.id
                  : `suggestion-${row.source}-${row.externalId ?? row.name}`
              const sourceLabel =
                row.kind === "suggestion"
                  ? row.source === "musicbrainz"
                    ? "MusicBrainz"
                    : "Last.fm"
                  : null
              return (
                <li
                  key={key}
                  role="option"
                  id={`band-option-${index}`}
                  aria-selected={index === highlightedIndex}
                  aria-label={
                    sourceLabel
                      ? `${row.name}, suggested from ${sourceLabel}`
                      : row.name
                  }
                  className={`band-autocomplete__option ${
                    index === highlightedIndex ? "band-autocomplete__option--highlighted" : ""
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    if (row.kind === "db") {
                      handleAddBand({
                        id: row.id,
                        name: row.name,
                        slug: row.slug,
                      })
                    } else {
                      void handleSelectSuggestion(row.name)
                    }
                  }}
                >
                  <span className="band-autocomplete__option-row">
                    <span className="band-autocomplete__option-name">
                      {renderPredictiveText(row.name)}
                    </span>
                    {sourceLabel && (
                      <span className="band-autocomplete__option-source" aria-hidden="true">
                        {sourceLabel}
                      </span>
                    )}
                  </span>
                </li>
              )
            })
          ) : (
            !isSearching &&
            searchTerm.length >= 2 && (
              <li className="band-autocomplete__no-results">
                <span>No bands found.</span>
                {onCreateBand && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateBand(searchTerm)
                      setSearchTerm("")
                      setIsOpen(false)
                    }}
                  >
                    Create &quot;{searchTerm}&quot;
                  </button>
                )}
              </li>
            )
          )}
        </ul>
      )}

      {/* Selected bands chips */}
      {selectedBands.length > 0 && (
        <div
          ref={chipsContainerRef}
          className="band-autocomplete__chips"
          role="listbox"
          aria-label="Selected bands. Use arrow keys to navigate, Space to pick up and move, Delete to remove"
          aria-orientation="horizontal"
        >
          {selectedBands.map((band, index) => {
            // Show separator between headliners and non-headliners
            const showSeparator =
              index > 0 &&
              !band.isHeadliner &&
              selectedBands[index - 1].isHeadliner

            // Determine drop indicator class (pink bar at target)
            const isDropBefore =
              dropTarget?.index === index &&
              dropTarget?.side === "before" &&
              draggingIndex !== null &&
              draggingIndex !== index
            const isDropAfter =
              dropTarget?.index === index &&
              dropTarget?.side === "after" &&
              draggingIndex !== null &&
              draggingIndex !== index

            // Show ghost at original position of dragged chip
            const isOriginalPosition = draggingIndex === index

            return (
              <Fragment key={band.bandId}>
                {showSeparator && (
                  <div className="band-autocomplete__separator" aria-hidden="true" />
                )}
                {/* Ghost placeholder at original position */}
                {isOriginalPosition && (
                  <div className="band-chip band-chip--ghost" aria-hidden="true">
                    <span className="band-chip__drag-handle">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <circle cx="9" cy="6" r="1.5" />
                        <circle cx="15" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" />
                        <circle cx="15" cy="18" r="1.5" />
                      </svg>
                    </span>
                    <span className="band-chip__name">{band.name}</span>
                    <span className="band-chip__headliner-toggle">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </span>
                    {isAdmin && band.slug && onEditBand && (
                      <span className="band-chip__edit">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <rect width="14" height="14" fill="transparent" />
                        </svg>
                      </span>
                    )}
                    <span className="band-chip__remove">
                      <svg viewBox="0 0 24 24" width="12" height="12">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </span>
                  </div>
                )}
                <div
                  ref={(el) => {
                    if (el) chipRefs.current.set(index, el)
                    else chipRefs.current.delete(index)
                  }}
                  className={`band-chip ${
                    draggingIndex === index ? "band-chip--dragging" : ""
                  } ${grabbedChipIndex === index ? "band-chip--grabbed" : ""} ${
                    isDropBefore ? "band-chip--drop-before" : ""
                  } ${isDropAfter ? "band-chip--drop-after" : ""}`}
                  role="option"
                  aria-selected={focusedChipIndex === index}
                  aria-grabbed={grabbedChipIndex === index}
                  tabIndex={focusedChipIndex === index ? 0 : -1}
                  onKeyDown={(e) => handleChipKeyDown(e, index)}
                  onPointerDown={(e) => handleDragStart(e, index)}
                >
                  {/* Drag handle */}
                  <button
                    type="button"
                    className="band-chip__drag-handle"
                    aria-label={`Drag to reorder ${band.name}`}
                    tabIndex={-1}
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                    >
                      <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                      <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                      <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                    </svg>
                  </button>

                  {/* Band name */}
                  <span className="band-chip__name">{band.name}</span>

                  {/* Headliner toggle */}
                  <button
                    type="button"
                    className={`band-chip__headliner-toggle ${
                      band.isHeadliner ? "band-chip__headliner-toggle--active" : ""
                    }`}
                    aria-label={`Mark ${band.name} as headliner`}
                    aria-pressed={band.isHeadliner}
                    title={band.isHeadliner ? "Remove headliner status" : "Mark as headliner"}
                    onClick={() => handleToggleHeadliner(band.bandId)}
                    tabIndex={-1}
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                    >
                      {band.isHeadliner ? (
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          fill="currentColor"
                        />
                      ) : (
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      )}
                    </svg>
                  </button>

                  {/* Edit button (admin only) */}
                  {isAdmin && band.slug && onEditBand && (
                    <button
                      type="button"
                      className="band-chip__edit"
                      onClick={() => onEditBand(band.slug)}
                      aria-label={`Edit ${band.name}`}
                      title={`Edit ${band.name}`}
                      tabIndex={-1}
                    >
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                      >
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
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    className="band-chip__remove"
                    onClick={() => handleRemoveBand(band.bandId, index)}
                    aria-label={`Remove ${band.name}`}
                    title={`Remove ${band.name}`}
                    tabIndex={-1}
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                    >
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
