import contentfulClient from './contentful';
import { getArtistInfo } from './lastfm';
import opencage from 'opencage-api-client';

/**
 * Normalize geocoding data to extract city name
 */
function normalizeCityName(components) {
  return components._normalized_city || components.city || components.town || components.village || '';
}

/**
 * Fetch geocoding data for a location
 */
async function getGeocodingData(lat, lon) {
  if (!process.env.OPENCAGE_API_KEY) {
    console.warn('OPENCAGE_API_KEY not set, skipping geocoding');
    return null;
  }

  const query = `${lat}, ${lon}`;
  const apiRequestOptions = {
    key: process.env.OPENCAGE_API_KEY,
    q: query,
  };

  try {
    const data = await opencage.geocode(apiRequestOptions);
    if (data.status.code === 200 && data.results.length > 0) {
      const place = data.results[0];
      return {
        ...place.components,
        _normalized_city: normalizeCityName(place.components),
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

/**
 * Transform Contentful concert entry to match expected format
 */
async function transformConcert(entry) {
  const geocodingData = await getGeocodingData(
    entry.fields.city.lat,
    entry.fields.city.lon
  );

  // Fetch Last.fm data for each band
  const bandsWithLastfm = await Promise.all(
    (entry.fields.bands || []).map(async (band) => {
      const lastfmData = await getArtistInfo(band.fields.name);
      return {
        id: band.sys.id,
        name: band.fields.name,
        slug: band.fields.slug,
        url: `/band/${band.fields.slug}/`,
        image: band.fields.image,
        fields: {
          lastfm: lastfmData,
        },
      };
    })
  );

  return {
    id: entry.sys.id,
    date: entry.fields.date,
    city: entry.fields.city,
    club: entry.fields.club,
    bands: bandsWithLastfm,
    isFestival: entry.fields.isFestival || false,
    festival: entry.fields.festival || null,
    fields: {
      geocoderAddressFields: geocodingData,
    },
  };
}

/**
 * Fetch all concerts from Contentful
 */
export async function getAllConcerts() {
  try {
    const entries = await contentfulClient.getEntries({
      content_type: 'concert',
      order: '-fields.date',
      limit: 1000,
    });

    const concerts = await Promise.all(
      entries.items.map(entry => transformConcert(entry))
    );

    return concerts;
  } catch (error) {
    console.error('Error fetching concerts:', error);
    return [];
  }
}

/**
 * Fetch all bands from Contentful
 */
export async function getAllBands() {
  try {
    const entries = await contentfulClient.getEntries({
      content_type: 'band',
      order: 'fields.name',
      limit: 1000,
    });

    const bands = await Promise.all(
      entries.items
        .filter(entry => entry.fields.slug !== 'data-schema')
        .map(async (entry) => {
          const lastfmData = await getArtistInfo(entry.fields.name);
          return {
            id: entry.sys.id,
            name: entry.fields.name,
            slug: entry.fields.slug,
            url: `/band/${entry.fields.slug}/`,
            image: entry.fields.image,
            lastfm: lastfmData,
            concert: entry.fields.concert || [],
          };
        })
    );

    return bands;
  } catch (error) {
    console.error('Error fetching bands:', error);
    return [];
  }
}

/**
 * Fetch concerts by band slug
 */
export async function getConcertsByBand(slug) {
  const allConcerts = await getAllConcerts();
  return allConcerts.filter(concert =>
    concert.bands.some(band => band.slug === slug)
  );
}

/**
 * Fetch concerts by year
 */
export async function getConcertsByYear(year) {
  const allConcerts = await getAllConcerts();
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year}-12-31`);
  
  return allConcerts.filter(concert => {
    const concertDate = new Date(concert.date);
    return concertDate >= yearStart && concertDate <= yearEnd;
  });
}

/**
 * Fetch concerts by city
 */
export async function getConcertsByCity(cityName) {
  const allConcerts = await getAllConcerts();
  return allConcerts.filter(concert =>
    concert.fields.geocoderAddressFields?._normalized_city === cityName
  );
}

/**
 * Get all unique years from concerts
 */
export async function getAllYears() {
  const allConcerts = await getAllConcerts();
  const now = new Date();
  const years = new Set();

  allConcerts.forEach(concert => {
    const concertDate = new Date(concert.date);
    if (concertDate < now) {
      years.add(concertDate.getFullYear().toString());
    }
  });

  return Array.from(years).sort();
}

/**
 * Get all unique cities from concerts
 */
export async function getAllCities() {
  const allConcerts = await getAllConcerts();
  const cities = new Set();

  allConcerts.forEach(concert => {
    const cityName = concert.fields.geocoderAddressFields?._normalized_city;
    if (cityName) {
      cities.add(cityName);
    }
  });

  return Array.from(cities);
}

/**
 * Get site metadata
 */
export function getSiteMetadata() {
  return {
    title: 'Concerts',
    description: "List of all concerts and festivals I've visited. Including pages for every band I ever saw.",
    author: '@juuro',
  };
}
