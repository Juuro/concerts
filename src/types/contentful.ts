/**
 * Contentful SDK types
 */

import type { Entry } from 'contentful';

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
  [key: string]: any;
}

export type ContentfulBandEntry = Entry<{
  contentTypeId: 'band';
  fields: ContentfulBandFields;
}>;

export interface ContentfulFestivalFields {
  name: string;
  url?: string;
  [key: string]: any;
}

export type ContentfulFestivalEntry = Entry<{
  contentTypeId: 'festival';
  fields: ContentfulFestivalFields;
}>;

export interface ContentfulConcertFields {
  date: string;
  city: ContentfulCity;
  club?: string;
  bands?: ContentfulBandEntry[];
  isFestival?: boolean;
  festival?: ContentfulFestivalEntry;
  [key: string]: any;
}

export type ContentfulConcertEntry = Entry<{
  contentTypeId: 'concert';
  fields: ContentfulConcertFields;
}>;
