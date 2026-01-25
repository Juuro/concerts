/**
 * Helper functions for type-safe Contentful entry access
 */

import type { Entry } from 'contentful';
import type { ContentfulConcertEntry, ContentfulBandEntry, ContentfulFestivalEntry, ContentfulConcertFields, ContentfulBandFields, ContentfulFestivalFields, ContentfulCity } from '../types/contentful';

/**
 * Type guard to check if an entry is a ContentfulConcertEntry
 */
export function isConcertEntry(entry: Entry<any>): entry is ContentfulConcertEntry {
  return entry.sys.contentType.sys.id === 'concert';
}

/**
 * Type guard to check if an entry is a ContentfulBandEntry
 */
export function isBandEntry(entry: Entry<any>): entry is ContentfulBandEntry {
  return entry.sys.contentType.sys.id === 'band';
}

/**
 * Safely extract ContentfulConcertFields from an entry
 */
export function getConcertFields(entry: Entry<any>): ContentfulConcertFields {
  return entry.fields as unknown as ContentfulConcertFields;
}

/**
 * Safely extract ContentfulBandFields from an entry
 */
export function getBandFields(entry: Entry<any>): ContentfulBandFields {
  return entry.fields as unknown as ContentfulBandFields;
}

/**
 * Safely extract ContentfulFestivalFields from an entry
 */
export function getFestivalFields(entry: Entry<any>): ContentfulFestivalFields {
  return entry.fields as unknown as ContentfulFestivalFields;
}

/**
 * Safely extract city from concert fields
 */
export function getCity(fields: ContentfulConcertFields): ContentfulCity {
  return fields.city as unknown as ContentfulCity;
}
