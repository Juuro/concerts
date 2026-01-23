/**
 * Last.fm API response types
 */

export interface LastFMImage {
  size?: string;
  '#text'?: string;
  url?: string;
}

export interface LastFMImageUrls {
  small: string | null;
  medium: string | null;
  large: string | null;
  extralarge: string | null;
  mega: string | null;
}

export interface LastFMTag {
  name: string;
  url?: string;
}

export interface LastFMArtistInfo {
  name: string;
  url: string;
  images: LastFMImageUrls;
  genres: string[];
  bio: string | null;
}

export type LastFMArtistInfoOrNull = LastFMArtistInfo | null;
