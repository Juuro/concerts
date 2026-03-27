export type BandSearchDbItem = {
  kind: "db";
  id: string;
  name: string;
  slug: string;
  url: string;
  imageUrl?: string | null;
  imageEnrichedAt?: Date | null;
  websiteUrl?: string | null;
  lastfm?: {
    url?: string | null;
    genres?: string[];
    bio?: string | null;
  } | null;
};

export type BandSearchSuggestionItem = {
  kind: "suggestion";
  name: string;
  source: "musicbrainz" | "lastfm";
  externalId?: string;
};

export type BandSearchResultItem = BandSearchDbItem | BandSearchSuggestionItem;
