/**
 * OpenCage Geocoding API response types
 */

export interface OpenCageComponents {
  _normalized_city?: string;
  city?: string;
  town?: string;
  village?: string;
  [key: string]: string | undefined;
}

export interface OpenCageResult {
  components: OpenCageComponents;
  geometry: {
    lat: number;
    lng: number;
  };
}

export interface OpenCageResponse {
  status: {
    code: number;
    message: string;
  };
  results: OpenCageResult[];
}

/**
 * Geocoding data returned by getGeocodingData
 */
export interface GeocodingData extends OpenCageComponents {
  _normalized_city: string;
  _is_coordinates?: boolean;
}
