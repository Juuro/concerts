/**
 * Utility functions for data transformation
 */

import type { GeocodingData } from "../types/geocoding"

/**
 * Character map for transliterating diacritics to ASCII equivalents
 */
const DIACRITIC_MAP: Record<string, string> = {
  // German
  "ä": "ae",
  "ö": "oe",
  "ü": "ue",
  "ß": "ss",
  "Ä": "Ae",
  "Ö": "Oe",
  "Ü": "Ue",
  // Scandinavian
  "å": "aa",
  "Å": "Aa",
  "æ": "ae",
  "Æ": "Ae",
  "ø": "oe",
  "Ø": "Oe",
  // French/Spanish/Portuguese
  "à": "a",
  "á": "a",
  "â": "a",
  "ã": "a",
  "À": "A",
  "Á": "A",
  "Â": "A",
  "Ã": "A",
  "è": "e",
  "é": "e",
  "ê": "e",
  "ë": "e",
  "È": "E",
  "É": "E",
  "Ê": "E",
  "Ë": "E",
  "ì": "i",
  "í": "i",
  "î": "i",
  "ï": "i",
  "Ì": "I",
  "Í": "I",
  "Î": "I",
  "Ï": "I",
  "ò": "o",
  "ó": "o",
  "ô": "o",
  "õ": "o",
  "Ò": "O",
  "Ó": "O",
  "Ô": "O",
  "Õ": "O",
  "ù": "u",
  "ú": "u",
  "û": "u",
  "Ù": "U",
  "Ú": "U",
  "Û": "U",
  "ñ": "n",
  "Ñ": "N",
  "ç": "c",
  "Ç": "C",
  "ý": "y",
  "ÿ": "y",
  "Ý": "Y",
  // Eastern European
  "ą": "a",
  "ć": "c",
  "ę": "e",
  "ł": "l",
  "ń": "n",
  "ś": "s",
  "ź": "z",
  "ż": "z",
  "Ą": "A",
  "Ć": "C",
  "Ę": "E",
  "Ł": "L",
  "Ń": "N",
  "Ś": "S",
  "Ź": "Z",
  "Ż": "Z",
  "č": "c",
  "ď": "d",
  "ě": "e",
  "ň": "n",
  "ř": "r",
  "š": "s",
  "ť": "t",
  "ů": "u",
  "ž": "z",
  "Č": "C",
  "Ď": "D",
  "Ě": "E",
  "Ň": "N",
  "Ř": "R",
  "Š": "S",
  "Ť": "T",
  "Ů": "U",
  "Ž": "Z",
  // Icelandic
  "ð": "d",
  "Ð": "D",
  "þ": "th",
  "Þ": "Th",
}

/**
 * Transliterate diacritics to ASCII equivalents
 */
function transliterate(str: string): string {
  return str
    .split("")
    .map((char) => DIACRITIC_MAP[char] || char)
    .join("")
}

/**
 * Convert a string to a URL-friendly slug
 * Handles diacritics by transliterating to ASCII equivalents
 */
export function slugify(text: string | null | undefined): string {
  if (!text) return ""
  return transliterate(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Convert city name to URL-friendly slug
 */
export function cityToSlug(cityName: string | null | undefined): string {
  return slugify(cityName)
}

/**
 * Extract city name from geocoding data
 */
export function extractCityName(
  geocodingData: GeocodingData | null | undefined
): string {
  if (!geocodingData) return ""
  return geocodingData._normalized_city || ""
}

/**
 * Find city name by slug
 */
export function findCityBySlug(slug: string, cities: string[]): string | null {
  return cities.find((city) => cityToSlug(city) === slug) || null
}
