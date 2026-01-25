/**
 * Utility functions for data transformation
 */

import type { GeocodingData } from '../types/geocoding';

/**
 * Convert city name to URL-friendly slug
 */
export function cityToSlug(cityName: string | null | undefined): string {
  if (!cityName) return '';
  return cityName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract city name from geocoding data
 */
export function extractCityName(geocodingData: GeocodingData | null | undefined): string {
  if (!geocodingData) return '';
  return geocodingData._normalized_city || '';
}

/**
 * Find city name by slug
 */
export function findCityBySlug(slug: string, cities: string[]): string | null {
  return cities.find((city) => cityToSlug(city) === slug) || null;
}
