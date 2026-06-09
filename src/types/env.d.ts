/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    PHOTON_BASE_URL?: string
    LASTFM_API_KEY?: string
    LASTFM_SECRET?: string
    ENABLE_LASTFM?: string
    ENABLE_GEOCODING?: string
    ENABLE_MUSICBRAINZ?: string
    ENABLE_MAP_PAGE?: string
    ENABLE_STATISTICS_WIDGET?: string
  }
}
