/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    CONTENTFUL_SPACE_ID: string;
    CONTENTFUL_DELIVERY_TOKEN: string;
    PHOTON_BASE_URL?: string;
    LASTFM_API_KEY?: string;
    LASTFM_SECRET?: string;
    ENABLE_LASTFM?: string;
    ENABLE_GEOCODING?: string;
  }
}
