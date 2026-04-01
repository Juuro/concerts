import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConcertCard from '../concertCard';
import type { TransformedConcert } from '@/lib/concerts';

describe('ConcertCard', () => {
  const mockConcert: TransformedConcert = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    date: '2024-06-15T19:00:00.000Z',
    city: {
      lat: 52.52,
      lon: 13.405,
    },
    venue: 'Test Venue',
    bands: [
      {
        id: 'band-1',
        name: 'Radiohead',
        slug: 'radiohead',
        url: '/band/radiohead',
        imageUrl: 'https://example.com/radiohead.jpg',
      },
      {
        id: 'band-2',
        name: 'Support Band',
        slug: 'support-band',
        url: '/band/support-band',
      },
    ],
    isFestival: false,
    festival: null,
    fields: {
      geocoderAddressFields: {
        _normalized_city: 'Berlin',
        city: 'Berlin',
      },
    },
  };

  it('test_ConcertCard_renders_main_band_name', () => {
    render(<ConcertCard concert={mockConcert} />);

    const bandLink = screen.getByRole('link', { name: 'Radiohead' });
    expect(bandLink).toBeInTheDocument();
    expect(bandLink).toHaveAttribute('href', '/band/radiohead');
  });

  it('test_ConcertCard_renders_support_bands_as_badges', () => {
    render(<ConcertCard concert={mockConcert} />);

    // Support band should be rendered (main band excluded from badges in non-festival)
    const supportBandLink = screen.getByRole('link', { name: 'Support Band' });
    expect(supportBandLink).toBeInTheDocument();
    expect(supportBandLink).toHaveAttribute('href', '/band/support-band');
  });

  it('test_ConcertCard_festival_shows_all_bands_as_badges', () => {
    const festivalConcert: TransformedConcert = {
      ...mockConcert,
      isFestival: true,
      festival: {
        fields: {
          name: 'Test Festival',
          url: 'https://testfestival.com',
        },
      },
    };

    render(<ConcertCard concert={festivalConcert} />);

    // For festivals, all bands should be rendered as links (none excluded)
    const radioheadBadge = screen.getByRole('link', { name: 'Radiohead' });
    const supportBadge = screen.getByRole('link', { name: 'Support Band' });

    expect(radioheadBadge).toBeInTheDocument();
    expect(radioheadBadge).toHaveAttribute('href', '/band/radiohead');
    expect(supportBadge).toBeInTheDocument();
    expect(supportBadge).toHaveAttribute('href', '/band/support-band');
  });

  it('test_ConcertCard_displays_venue_and_city', () => {
    render(<ConcertCard concert={mockConcert} />);

    expect(screen.getByText('Test Venue')).toBeInTheDocument();

    const cityLink = screen.getByRole('link', { name: 'Berlin' });
    expect(cityLink).toBeInTheDocument();
    expect(cityLink).toHaveAttribute('href', '/city/berlin');
  });

  it('test_ConcertCard_displays_formatted_date', () => {
    render(<ConcertCard concert={mockConcert} />);

    // Date formatted as German locale: "15. Juni 2024"
    expect(screen.getByText(/juni 2024/i)).toBeInTheDocument();
  });

  describe('future vs past CSS class', () => {
    /** Fixed "today" so isInTheFuture() (concert date vs new Date().toISOString()) is deterministic. */
    const frozenNow = new Date('2026-01-01T12:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(frozenNow);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('test_ConcertCard_future_concert_has_future_class', () => {
      const futureConcert: TransformedConcert = {
        ...mockConcert,
        date: '2027-12-31T20:00:00.000Z',
      };

      const { container } = render(<ConcertCard concert={futureConcert} />);

      const card = container.querySelector('.concert-card');
      expect(card).toHaveClass('future');
    });

    it('test_ConcertCard_past_concert_no_future_class', () => {
      const { container } = render(<ConcertCard concert={mockConcert} />);

      const card = container.querySelector('.concert-card');
      expect(card).not.toHaveClass('future');
    });
  });

  it('test_ConcertCard_renders_image_when_available', () => {
    const { container } = render(<ConcertCard concert={mockConcert} />);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/radiohead.jpg');
  });

  it('test_ConcertCard_renders_placeholder_when_no_image', () => {
    const concertWithoutImage: TransformedConcert = {
      ...mockConcert,
      bands: [
        {
          id: 'band-1',
          name: 'No Image Band',
          slug: 'no-image-band',
          url: '/band/no-image-band',
        },
      ],
    };

    const { container } = render(<ConcertCard concert={concertWithoutImage} />);

    const placeholder = container.querySelector('.concert-card-image-placeholder');
    expect(placeholder).toBeInTheDocument();
  });
});
