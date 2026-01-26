/**
 * Photon reverse geocoding response types
 * https://photon.komoot.io
 */

export interface PhotonProperties {
  name?: string;
  city?: string;
  locality?: string;
  county?: string;
  state?: string;
  country?: string;
  [key: string]: unknown;
}

export interface PhotonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: PhotonProperties;
}

export interface PhotonReverseResponse {
  type: "FeatureCollection";
  features: PhotonFeature[];
}

/**
 * Geocoding data returned by getGeocodingData
 */
export interface GeocodingData {
  _normalized_city: string;
  _is_coordinates?: boolean;
  city?: string;
  locality?: string;
  name?: string;
  county?: string;
  state?: string;
  country?: string;
  town?: string;
  village?: string;
  [key: string]: string | boolean | undefined;
}
