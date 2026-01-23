/**
 * Contentful SDK types
 */

import type { Entry, Asset } from 'contentful';

export interface ContentfulCity {
  lat: number;
  lon: number;
}

export interface ContentfulImage {
  sys?: {
    id: string;
  };
  fields?: {
    file?: {
      url: string;
    };
  };
  file?: {
    url: string;
  };
}

export interface ContentfulBandFields {
  name: string;
  slug: string;
  image?: ContentfulImage;
}

export interface ContentfulBandEntry extends Entry {
  fields: ContentfulBandFields;
}

export interface ContentfulFestivalFields {
  name: string;
  url?: string;
}

export interface ContentfulFestivalEntry extends Entry {
  fields: ContentfulFestivalFields;
}

export interface ContentfulConcertFields {
  date: string;
  city: ContentfulCity;
  club?: string;
  bands?: ContentfulBandEntry[];
  isFestival?: boolean;
  festival?: ContentfulFestivalEntry;
}

export interface ContentfulConcertEntry extends Entry {
  fields: ContentfulConcertFields;
}
