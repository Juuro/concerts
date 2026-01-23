/**
 * Utility module for interacting with Last.fm API
 */

import { LastFMArtist } from 'lastfm-ts-api';
import { isFeatureEnabled, FEATURE_FLAGS } from './featureFlags';
import type { LastFMArtistInfoOrNull } from '../types/lastfm';

// Build-time cache to prevent duplicate API calls during static generation
const artistCache = new Map<string, LastFMArtistInfoOrNull>();
// Track pending requests to prevent duplicate concurrent calls
const pendingRequests = new Map<string, Promise<LastFMArtistInfoOrNull>>();
// Track rate limit errors with timestamps for retry logic
const rateLimitErrors = new Map<string, number>();
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests to respect rate limits
const RATE_LIMIT_RETRY_DELAY = 5000; // 5 seconds before retrying after rate limit
const MAX_RETRIES = 3;

/**
 * Fetch artist information from Last.fm
 */
export const getArtistInfo = async (
  artistName: string,
  retryCount = 0
): Promise<LastFMArtistInfoOrNull> => {
  // Check feature flag first - if disabled, return null immediately
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM, true)) {
    return null;
  }

  if (!process.env.LASTFM_API_KEY) {
    console.warn("Last.fm API key not configured, skipping artist info fetch");
    return null;
  }

  // Normalize cache key
  const cacheKey = artistName.toLowerCase().trim();

  // Check cache first (prevents duplicate calls during build)
  if (artistCache.has(cacheKey)) {
    const cached = artistCache.get(cacheKey);
    // Return cached result, but if it's a rate limit error, check if we should retry
    if (cached === null && rateLimitErrors.has(cacheKey)) {
      const errorTime = rateLimitErrors.get(cacheKey);
      if (errorTime !== undefined) {
        const timeSinceError = Date.now() - errorTime;
        if (timeSinceError < RATE_LIMIT_RETRY_DELAY) {
          // Still in cooldown period, return null
          return null;
        }
        // Cooldown expired, clear error and retry
        rateLimitErrors.delete(cacheKey);
        artistCache.delete(cacheKey);
      }
    } else {
      return cached ?? null;
    }
  }

  // Check if request is already pending (prevents duplicate concurrent calls)
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  // Rate limiting: ensure minimum interval between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  // Create pending request promise
  const requestPromise = (async (): Promise<LastFMArtistInfoOrNull> => {
    try {
      const artist = new LastFMArtist(process.env.LASTFM_API_KEY!);
      const data = await artist.getInfo({ artist: artistName, autocorrect: 1 });

      if (!data || !data.artist) {
        console.warn(`No Last.fm data found for ${artistName}`);
        artistCache.set(cacheKey, null);
        return null;
      }

      const artistData = data.artist;

      // Extract image URLs - Last.fm returns images in different sizes
      // Handle both array format and object format
      const images = artistData.image || [];
      const imageUrls = {
        small: null as string | null,
        medium: null as string | null,
        large: null as string | null,
        extralarge: null as string | null,
        mega: null as string | null,
      };

      if (Array.isArray(images)) {
        images.forEach((img: any) => {
          const size = img.size || (img['#text'] ? 'medium' : null);
          const url = img['#text'] || img.url || null;
          if (size && url) {
            if (size === 'small') imageUrls.small = url;
            else if (size === 'medium') imageUrls.medium = url;
            else if (size === 'large') imageUrls.large = url;
            else if (size === 'extralarge') imageUrls.extralarge = url;
            else if (size === 'mega') imageUrls.mega = url;
          }
        });
      }

      // Extract genres/tags
      const tags = artistData.tags?.tag || [];
      const genres = Array.isArray(tags)
        ? tags.map((tag: any) => (typeof tag === 'string' ? tag : tag.name))
        : [];

      const result = {
        name: artistData.name,
        url: artistData.url,
        images: imageUrls,
        genres: genres,
        bio: artistData.bio?.summary || null,
      };

      // Cache successful response
      artistCache.set(cacheKey, result);
      return result;
    } catch (error: any) {
      // Handle "artist not found" as a normal case
      if (error.message?.includes('could not be found') ||
          error.message?.includes('not found')) {
        // Cache null to prevent repeated API calls for missing artists
        artistCache.set(cacheKey, null);
        // Log as warning (not error) since this is expected behavior
        console.warn(`Artist "${artistName}" not found in Last.fm database`);
        return null;
      }

      // Handle rate limit errors with retry logic
      if (error.message?.includes('Rate Limit Exceeded')) {
        if (retryCount < MAX_RETRIES) {
          // Cache rate limit error with timestamp
          rateLimitErrors.set(cacheKey, Date.now());
          artistCache.set(cacheKey, null);
          
          // Wait before retrying with exponential backoff
          const backoffDelay = Math.min(RATE_LIMIT_RETRY_DELAY * Math.pow(2, retryCount), 30000);
          console.warn(`Last.fm rate limit exceeded for ${artistName}. Retrying after ${backoffDelay}ms...`);
          
          // Clear pending request before retrying
          pendingRequests.delete(cacheKey);
          
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          
          // Retry the request (will create new pending request)
          return getArtistInfo(artistName, retryCount + 1);
        } else {
          console.warn(`Last.fm rate limit exceeded for ${artistName} after ${MAX_RETRIES} retries. Skipping.`);
          rateLimitErrors.set(cacheKey, Date.now());
          artistCache.set(cacheKey, null);
          return null;
        }
      }

      // Handle timeout errors with retry
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout') || error.message?.includes('ECONNRESET')) {
        if (retryCount < MAX_RETRIES) {
          const retryDelay = 1000 * (retryCount + 1); // 1s, 2s, 3s
          console.warn(`Last.fm timeout for ${artistName}. Retrying after ${retryDelay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          
          // Clear pending request before retrying
          pendingRequests.delete(cacheKey);
          
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          
          // Retry the request (will create new pending request)
          return getArtistInfo(artistName, retryCount + 1);
        } else {
          console.error(`Last.fm timeout for ${artistName} after ${MAX_RETRIES} retries. Giving up.`);
          artistCache.set(cacheKey, null);
          return null;
        }
      }

      // Log actual errors (network issues, API problems, etc.)
      console.error(`Error fetching Last.fm data for ${artistName}:`, error);
      artistCache.set(cacheKey, null);
      return null;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();

  // Store pending request
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
};
