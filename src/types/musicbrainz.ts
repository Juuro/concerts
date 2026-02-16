// MusicBrainz API types

export interface MusicBrainzArtistSearchResponse {
  created: string;
  count: number;
  offset: number;
  artists: MusicBrainzArtistSearchResult[];
}

export interface MusicBrainzArtistSearchResult {
  id: string; // MBID
  name: string;
  score: number; // relevance score 0-100
  disambiguation?: string;
  type?: string; // "Group", "Person", etc.
}

export interface MusicBrainzArtistLookupResponse {
  id: string;
  name: string;
  type?: string;
  relations?: MusicBrainzRelation[];
}

export interface MusicBrainzRelation {
  type: string; // e.g. "wikidata", "wikipedia", "official homepage"
  url: {
    resource: string; // e.g. "https://www.wikidata.org/wiki/Q483"
  };
}

// Wikidata API types

export interface WikidataEntitiesResponse {
  entities: Record<
    string,
    {
      type: string;
      id: string;
      claims: Record<string, WikidataClaim[]>;
    }
  >;
}

export interface WikidataClaim {
  mainsnak: {
    snaktype: string;
    property: string;
    datavalue?: {
      value: string;
      type: string;
    };
  };
}

// Wikimedia Commons API types

export interface WikimediaCommonsQueryResponse {
  query: {
    pages: Record<
      string,
      {
        title: string;
        imageinfo?: WikimediaImageInfo[];
      }
    >;
  };
}

export interface WikimediaImageInfo {
  url: string;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
}
