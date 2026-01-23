/**
 * Utility functions for data transformation
 */

/**
 * Convert city name to URL-friendly slug
 * @param {string} cityName - City name to convert
 * @returns {string} URL-friendly slug
 */
export function cityToSlug(cityName) {
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
 * @param {object} geocodingData - Geocoding address components
 * @returns {string} Normalized city name
 */
export function extractCityName(geocodingData) {
  if (!geocodingData) return '';
  return geocodingData._normalized_city || '';
}

/**
 * Find city name by slug
 * @param {string} slug - URL slug
 * @param {Array} cities - List of city names
 * @returns {string|null} City name or null if not found
 */
export function findCityBySlug(slug, cities) {
  return cities.find((city) => cityToSlug(city) === slug) || null;
}
