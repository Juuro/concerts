/**
 * Transformed concert and band data types
 */

import type { LastFMArtistInfoOrNull } from './lastfm';
import type { GeocodingData } from './geocoding';
import type { ContentfulImage } from './contentful';

export interface Band {
  id: string;
  name: string;
  slug: string;
  url: string;
  image?: ContentfulImage;
  lastfm?: LastFMArtistInfoOrNull;
  concert?: Concert[];
}

export interface Festival {
  fields: {
    name: string;
    url?: string;
  };
}

export interface Concert {
  id: string;
  date: string;
  city: {
    lat: number;
    lon: number;
  };
  venue?: string | null;
  bands: Band[];
  isFestival: boolean;
  festival: Festival | null;
  fields: {
    geocoderAddressFields: GeocodingData;
  };
}

export interface ConcertsFormatted {
  edges: Array<{
    node: Concert;
  }>;
  totalCount: number;
}

export interface SiteMetadata {
  title: string;
  description: string;
  author: string;
}
