/**
 * Ticketmaster Discovery API client for concert venue search
 * https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */

import * as Sentry from "@sentry/nextjs"
import { z } from "zod"
import type { EnhancedVenueResult } from "@/types/photon"

// Zod schema for Ticketmaster venue response validation
const TicketmasterVenueSchema = z.object({
  name: z.string(),
  id: z.string(),
  url: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  city: z
    .object({
      name: z.string(),
    })
    .optional(),
  state: z
    .object({
      name: z.string().optional(),
      stateCode: z.string().optional(),
    })
    .optional(),
  country: z
    .object({
      name: z.string().optional(),
      countryCode: z.string().optional(),
    })
    .optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
    })
    .optional(),
  postalCode: z.string().optional(),
  location: z
    .object({
      longitude: z.string(),
      latitude: z.string(),
    })
    .optional(),
})

const TicketmasterResponseSchema = z.object({
  _embedded: z
    .object({
      venues: z.array(TicketmasterVenueSchema),
    })
    .optional(),
  page: z
    .object({
      size: z.number(),
      totalElements: z.number(),
      totalPages: z.number(),
      number: z.number(),
    })
    .optional(),
})

type TicketmasterVenue = z.infer<typeof TicketmasterVenueSchema>

/**
 * Format a display name from Ticketmaster venue data
 */
function formatDisplayName(venue: TicketmasterVenue): string {
  const parts: string[] = []

  if (venue.address?.line1) {
    parts.push(venue.address.line1)
  }

  if (venue.postalCode && venue.city?.name) {
    parts.push(`${venue.postalCode} ${venue.city.name}`)
  } else if (venue.city?.name) {
    parts.push(venue.city.name)
  }

  if (venue.country?.name) {
    parts.push(venue.country.name)
  }

  return parts.join(", ")
}

/**
 * Search Ticketmaster Discovery API for concert venues.
 *
 * @param query - Search query string (minimum 3 characters)
 * @param options - Optional search options
 * @returns Array of venue search results
 */
export async function searchTicketmasterVenues(
  query: string,
  options?: {
    lat?: number
    lon?: number
    countryCode?: string
  }
): Promise<EnhancedVenueResult[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY

  // Skip if no API key configured
  if (!apiKey) {
    return []
  }

  // Require minimum 3 characters
  if (query.length < 3) {
    return []
  }

  try {
    const url = new URL("https://app.ticketmaster.com/discovery/v2/venues.json")
    url.searchParams.set("apikey", apiKey)
    url.searchParams.set("keyword", query)
    url.searchParams.set("size", "10")

    // Bias results by location if provided
    if (options?.lat !== undefined && options?.lon !== undefined) {
      url.searchParams.set("latlong", `${options.lat},${options.lon}`)
    }

    // Filter by country if provided
    if (options?.countryCode) {
      url.searchParams.set("countryCode", options.countryCode)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      // CRITICAL: Never log URL (contains API key)
      console.error(`Ticketmaster error: ${res.status} ${res.statusText}`)
      Sentry.captureMessage("Ticketmaster API error", {
        level: "warning",
        extra: { status: res.status, statusText: res.statusText },
      })
      return []
    }

    const json = await res.json()

    // Validate response schema
    const parsed = TicketmasterResponseSchema.safeParse(json)
    if (!parsed.success) {
      console.error(
        "Invalid Ticketmaster response schema:",
        parsed.error.message
      )
      Sentry.captureMessage("Invalid Ticketmaster response schema", {
        level: "warning",
        extra: { error: parsed.error.message },
      })
      return []
    }

    const venues = parsed.data._embedded?.venues || []

    // Transform to EnhancedVenueResult format
    return venues
      .filter((venue) => venue.location?.latitude && venue.location?.longitude)
      .map((venue) => ({
        name: venue.name,
        displayName: formatDisplayName(venue),
        street: venue.address?.line1,
        postcode: venue.postalCode,
        city: venue.city?.name,
        state: venue.state?.name,
        country: venue.country?.name,
        lat: parseFloat(venue.location!.latitude),
        lon: parseFloat(venue.location!.longitude),
        source: "ticketmaster" as const,
        score: 30, // Base score for Ticketmaster results
      }))
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Ticketmaster request timed out")
    } else {
      console.error("Ticketmaster fetch failed")
    }
    // CRITICAL: Don't expose API key in error
    Sentry.captureException(new Error("Ticketmaster fetch failed"), {
      extra: { query },
    })
    return []
  }
}
