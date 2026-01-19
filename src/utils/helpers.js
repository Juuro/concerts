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
  return cityName.toLowerCase().replace(/\s+/g, '-');
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
