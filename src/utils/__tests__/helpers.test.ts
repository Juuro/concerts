import { describe, it, expect } from "vitest"
import {
  cityToSlug,
  extractCityName,
  findCityBySlug,
  haversineDistance,
} from "../helpers"
import type { GeocodingData } from "../../types/geocoding"

describe("helpers", () => {
  describe("cityToSlug", () => {
    it("test_cityToSlug_valid_input_converts_to_kebab_case", () => {
      expect(cityToSlug("New York")).toBe("new-york")
      expect(cityToSlug("San Francisco")).toBe("san-francisco")
      expect(cityToSlug("Berlin Mitte")).toBe("berlin-mitte")
    })

    it("test_cityToSlug_special_characters_removed", () => {
      expect(cityToSlug("São Paulo")).toBe("sao-paulo") // Diacritics stripped/transliterated to base characters
      expect(cityToSlug("Paris, France")).toBe("paris-france")
      expect(cityToSlug("New York!")).toBe("new-york")
    })

    it("test_cityToSlug_empty_string_returns_empty", () => {
      expect(cityToSlug("")).toBe("")
      expect(cityToSlug(null)).toBe("")
      expect(cityToSlug(undefined)).toBe("")
    })

    it("test_cityToSlug_multiple_spaces_collapsed_to_single_dash", () => {
      expect(cityToSlug("New    York")).toBe("new-york")
      expect(cityToSlug("  Berlin  ")).toBe("berlin")
    })
  })

  describe("extractCityName", () => {
    it("test_extractCityName_with_normalized_city_returns_city", () => {
      const geocodingData: GeocodingData = {
        _normalized_city: "Berlin",
        city: "Berlin",
      }
      expect(extractCityName(geocodingData)).toBe("Berlin")
    })

    it("test_extractCityName_null_returns_empty_string", () => {
      expect(extractCityName(null)).toBe("")
      expect(extractCityName(undefined)).toBe("")
    })

    it("test_extractCityName_empty_normalized_city_returns_empty", () => {
      const geocodingData: GeocodingData = {
        _normalized_city: "",
      }
      expect(extractCityName(geocodingData)).toBe("")
    })
  })

  describe("findCityBySlug", () => {
    const cities = ["New York", "Los Angeles", "Berlin", "São Paulo"]

    it("test_findCityBySlug_matching_slug_returns_city", () => {
      expect(findCityBySlug("new-york", cities)).toBe("New York")
      expect(findCityBySlug("berlin", cities)).toBe("Berlin")
    })

    it("test_findCityBySlug_non_matching_slug_returns_null", () => {
      expect(findCityBySlug("paris", cities)).toBeNull()
      expect(findCityBySlug("london", cities)).toBeNull()
    })

    it("test_findCityBySlug_empty_array_returns_null", () => {
      expect(findCityBySlug("new-york", [])).toBeNull()
    })
  })

  describe("haversineDistance", () => {
    it("test_haversineDistance_identical_points_is_zero", () => {
      expect(haversineDistance(52.52, 13.405, 52.52, 13.405)).toBe(0)
    })

    it("test_haversineDistance_known_cities_matches_expected_km", () => {
      // Berlin ↔ Paris ≈ 878 km (great-circle)
      const km = haversineDistance(52.52, 13.405, 48.8566, 2.3522)
      expect(km).toBeGreaterThan(870)
      expect(km).toBeLessThan(890)
    })
  })
})
