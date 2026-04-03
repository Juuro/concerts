import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import ConcertCard from "../concertCard"
import type { TransformedConcert } from "@/lib/concerts/types"

describe("ConcertCard", () => {
  const mockConcert: TransformedConcert = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    date: "2024-06-15T19:00:00.000Z",
    city: {
      lat: 52.52,
      lon: 13.405,
    },
    venue: "Test Venue",
    bands: [
      {
        id: "band-1",
        name: "Radiohead",
        slug: "radiohead",
        url: "/band/radiohead",
        imageUrl: "https://example.com/radiohead.jpg",
      },
      {
        id: "band-2",
        name: "Support Band",
        slug: "support-band",
        url: "/band/support-band",
      },
    ],
    isFestival: false,
    festival: null,
    fields: {
      geocoderAddressFields: {
        _normalized_city: "Berlin",
        city: "Berlin",
      },
    },
  }

  it("test_ConcertCard_when_default_concert_renders_main_band_as_link", () => {
    render(<ConcertCard concert={mockConcert} />)

    const bandLink = screen.getByRole("link", { name: "Radiohead" })
    expect(bandLink).toBeInTheDocument()
    expect(bandLink).toHaveAttribute("href", "/band/radiohead")
  })

  it("test_ConcertCard_when_support_act_present_renders_support_bands_as_badges", () => {
    render(<ConcertCard concert={mockConcert} />)

    // Support band should be rendered (main band excluded from badges in non-festival)
    const supportBandLink = screen.getByRole("link", { name: "Support Band" })
    expect(supportBandLink).toBeInTheDocument()
    expect(supportBandLink).toHaveAttribute("href", "/band/support-band")
  })

  it("test_ConcertCard_when_festival_renders_all_bands_as_badges", () => {
    const festivalConcert: TransformedConcert = {
      ...mockConcert,
      isFestival: true,
      festival: {
        fields: {
          name: "Test Festival",
          url: "https://testfestival.com",
        },
      },
    }

    render(<ConcertCard concert={festivalConcert} />)

    // For festivals, all bands should be rendered as links (none excluded)
    const radioheadBadge = screen.getByRole("link", { name: "Radiohead" })
    const supportBadge = screen.getByRole("link", { name: "Support Band" })

    expect(radioheadBadge).toBeInTheDocument()
    expect(radioheadBadge).toHaveAttribute("href", "/band/radiohead")
    expect(supportBadge).toBeInTheDocument()
    expect(supportBadge).toHaveAttribute("href", "/band/support-band")
  })

  it("test_ConcertCard_when_rendered_shows_venue_and_city_links", () => {
    render(<ConcertCard concert={mockConcert} />)

    expect(screen.getByText("Test Venue")).toBeInTheDocument()

    const cityLink = screen.getByRole("link", { name: "Berlin" })
    expect(cityLink).toBeInTheDocument()
    expect(cityLink).toHaveAttribute("href", "/city/berlin")
  })

  it("test_ConcertCard_when_rendered_shows_locale_formatted_date", () => {
    render(<ConcertCard concert={mockConcert} />)

    // Date formatted as German locale: "15. Juni 2024"
    expect(screen.getByText(/juni 2024/i)).toBeInTheDocument()
  })

  describe("future vs past CSS class", () => {
    /** Fixed "today" so isInTheFuture() (concert date vs new Date().toISOString()) is deterministic. */
    const frozenNow = new Date("2026-01-01T12:00:00.000Z")

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(frozenNow)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("test_ConcertCard_when_concert_date_after_today_has_future_class", () => {
      const futureConcert: TransformedConcert = {
        ...mockConcert,
        date: "2027-12-31T20:00:00.000Z",
      }

      const { container } = render(<ConcertCard concert={futureConcert} />)

      const card = container.querySelector(".concert-card")
      expect(card).toHaveClass("future")
    })

    it("test_ConcertCard_when_concert_date_before_today_has_no_future_class", () => {
      const { container } = render(<ConcertCard concert={mockConcert} />)

      const card = container.querySelector(".concert-card")
      expect(card).not.toHaveClass("future")
    })
  })

  it("test_ConcertCard_when_band_has_imageUrl_renders_img", () => {
    const { container } = render(<ConcertCard concert={mockConcert} />)

    const img = container.querySelector("img")
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", "https://example.com/radiohead.jpg")
  })

  it("test_ConcertCard_when_band_has_no_imageUrl_renders_placeholder", () => {
    const concertWithoutImage: TransformedConcert = {
      ...mockConcert,
      bands: [
        {
          id: "band-1",
          name: "No Image Band",
          slug: "no-image-band",
          url: "/band/no-image-band",
        },
      ],
    }

    const { container } = render(<ConcertCard concert={concertWithoutImage} />)

    const placeholder = container.querySelector(
      ".concert-card-image-placeholder"
    )
    expect(placeholder).toBeInTheDocument()
  })

  it("test_ConcertCard_when_hideLocation_true_does_not_render_venue_or_city", () => {
    render(<ConcertCard concert={mockConcert} hideLocation />)

    expect(screen.queryByText("Test Venue")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Berlin" })
    ).not.toBeInTheDocument()
  })

  it("test_ConcertCard_when_hideCost_true_does_not_render_cost", () => {
    const concertWithCost: TransformedConcert = {
      ...mockConcert,
      cost: "50",
    }

    render(<ConcertCard concert={concertWithCost} hideCost currency="EUR" />)

    expect(screen.queryByText(/50\s*EUR/i)).not.toBeInTheDocument()
  })

  it("test_ConcertCard_when_first_band_missing_renders_unknown_band_heading", () => {
    const noBandsConcert: TransformedConcert = {
      ...mockConcert,
      bands: [],
    }

    render(<ConcertCard concert={noBandsConcert} />)
    expect(screen.getByText("Unknown band")).toBeInTheDocument()
  })

  it("test_ConcertCard_when_image_url_protocol_relative_prefixes_https", () => {
    const protocolRelative: TransformedConcert = {
      ...mockConcert,
      bands: [
        {
          id: "band-1",
          name: "Radiohead",
          slug: "radiohead",
          url: "/band/radiohead",
          imageUrl: "//cdn.example.com/radiohead.jpg",
        },
      ],
    }

    const { container } = render(<ConcertCard concert={protocolRelative} />)
    const img = container.querySelector("img")
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", "https://cdn.example.com/radiohead.jpg")
  })

  it("test_ConcertCard_when_hideLocation_true_and_future_hides_date_meta", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"))

    const futureConcert: TransformedConcert = {
      ...mockConcert,
      date: "2027-12-31T20:00:00.000Z",
    }

    render(<ConcertCard concert={futureConcert} hideLocation />)
    expect(screen.queryByText(/2027/i)).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it("test_ConcertCard_when_attendee_count_above_one_renders_attendee_badge", () => {
    const sharedConcert: TransformedConcert = {
      ...mockConcert,
      attendeeCount: 3,
    }
    render(<ConcertCard concert={sharedConcert} />)
    expect(screen.getByText("3 attended")).toBeInTheDocument()
  })

  it("test_ConcertCard_when_user_matches_attendance_shows_edit_button", () => {
    const editableConcert: TransformedConcert = {
      ...mockConcert,
      attendance: {
        id: "attendance-1",
        userId: "user-1",
        cost: null,
        notes: null,
      },
    }
    render(
      <ConcertCard
        concert={editableConcert}
        showEditButton
        currentUserId="user-1"
      />
    )
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/concerts/edit/${mockConcert.id}`
    )
  })
})
