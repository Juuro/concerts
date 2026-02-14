"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { PhotonSearchResult } from "@/types/photon"
import "./venueAutocomplete.scss"

interface VenueAutocompleteProps {
  value: string
  latitude?: number
  longitude?: number
  onSelect: (result: PhotonSearchResult) => void
  onClear: () => void
  disabled?: boolean
  error?: string
}

export default function VenueAutocomplete({
  value,
  latitude,
  longitude,
  onSelect,
  onClear,
  disabled = false,
  error,
}: VenueAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState(value)
  const [results, setResults] = useState<PhotonSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced search (300ms)
  useEffect(() => {
    if (searchTerm.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const params = new URLSearchParams({ q: searchTerm })
        if (latitude && longitude) {
          params.set("lat", String(latitude))
          params.set("lon", String(longitude))
        }

        const res = await fetch(`/api/venues/search?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setIsOpen(data.length > 0)
        }
      } catch (err) {
        console.error("Venue search error:", err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, latitude, longitude])

  // Update search term when value prop changes
  useEffect(() => {
    setSearchTerm(value)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (result: PhotonSearchResult) => {
      setSearchTerm(result.name)
      setIsOpen(false)
      setHighlightedIndex(-1)
      onSelect(result)
    },
    [onSelect]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex])
        }
        break
      case " ":
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          e.preventDefault()
          handleSelect(results[highlightedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case "Tab":
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const handleClear = () => {
    setSearchTerm("")
    setResults([])
    setIsOpen(false)
    setHighlightedIndex(-1)
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div className="venue-autocomplete">
      <div className="venue-autocomplete__input-wrapper">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls="venue-listbox"
          aria-activedescendant={
            highlightedIndex >= 0
              ? `venue-option-${highlightedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-haspopup="listbox"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a venue (min 3 characters)..."
          disabled={disabled}
          className={error ? "venue-autocomplete__input--error" : ""}
        />
        {searchTerm && (
          <button
            type="button"
            className="venue-autocomplete__clear"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
        {isSearching && (
          <span className="venue-autocomplete__loading">Searching...</span>
        )}
      </div>

      {error && <div className="venue-autocomplete__error">{error}</div>}

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="venue-autocomplete__dropdown"
          role="listbox"
          id="venue-listbox"
          aria-label="Venue search results"
        >
          {results.map((result, index) => (
            <button
              key={`${result.osmId}-${index}`}
              type="button"
              role="option"
              id={`venue-option-${index}`}
              aria-selected={index === highlightedIndex}
              className={`venue-autocomplete__item ${
                index === highlightedIndex ? "highlighted" : ""
              }`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="venue-autocomplete__item-name">
                {result.name}
              </div>
              <div className="venue-autocomplete__item-address">
                {result.displayName}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !isSearching && searchTerm.length >= 3 && results.length === 0 && (
        <div className="venue-autocomplete__no-results">
          No venues found. Try a different search.
        </div>
      )}
    </div>
  )
}
