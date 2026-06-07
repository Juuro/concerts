/**
 * Raw Setlist.fm REST API response types (rest/1.0).
 * Docs: https://api.setlist.fm/docs/1.0/index.html
 *
 * Only the fields this app consumes are typed. Many fields are optional in
 * practice — Setlist.fm frequently omits `coords` and `country` on older or
 * obscure shows, so callers MUST treat location data as best-effort.
 */

export interface SetlistfmCoords {
  lat?: number
  // NOTE: Setlist.fm uses `long` (not `lon`) for longitude.
  long?: number
}

export interface SetlistfmCountry {
  code?: string
  name?: string
}

export interface SetlistfmCity {
  id?: string
  name?: string
  state?: string
  stateCode?: string
  coords?: SetlistfmCoords
  country?: SetlistfmCountry
}

export interface SetlistfmVenue {
  id?: string
  name?: string
  url?: string
  city?: SetlistfmCity
}

export interface SetlistfmArtist {
  mbid?: string
  name: string
  sortName?: string
  url?: string
}

export interface SetlistfmTour {
  name?: string
}

export interface SetlistfmSet {
  name?: string
  encore?: number
  song?: Array<{ name?: string }>
}

export interface SetlistfmSetlist {
  id: string
  versionId?: string
  /** Event date in `dd-MM-yyyy` format. */
  eventDate: string
  lastUpdated?: string
  artist: SetlistfmArtist
  venue?: SetlistfmVenue
  tour?: SetlistfmTour
  sets?: { set?: SetlistfmSet[] }
  info?: string
  url?: string
}

export interface SetlistfmSearchSetlistsResponse {
  type?: string
  itemsPerPage?: number
  page?: number
  total?: number
  setlist?: SetlistfmSetlist[]
}

export interface SetlistfmSearchArtistsResponse {
  type?: string
  itemsPerPage?: number
  page?: number
  total?: number
  artist?: SetlistfmArtist[]
}
