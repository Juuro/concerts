/**
 * Utility module for fetching CC-licensed artist images via
 * MusicBrainz → Wikidata → Wikimedia Commons pipeline.
 *
 * Rate limiting follows the same patterns as lastfm.ts.
 * MusicBrainz requires max 1 request per second and a descriptive User-Agent.
 */

import { isFeatureEnabled, FEATURE_FLAGS } from "./featureFlags";
import type {
  MusicBrainzArtistSearchResponse,
  MusicBrainzArtistLookupResponse,
  MusicBrainzEventSearchResponse,
  WikidataEntitiesResponse,
  WikimediaCommonsQueryResponse,
} from "../types/musicbrainz";

const USER_AGENT = "ConcertsApp/1.0.0 (https://github.com/Juuro/concerts)";
const IMAGE_THUMBNAIL_WIDTH = 500;

// Rate limiting infrastructure (MusicBrainz: max 1 req/sec)
const MIN_REQUEST_INTERVAL = 1100; // slightly over 1s to stay safe
const GLOBAL_RATE_LIMIT_COOLDOWN = 120_000; // 2 minutes
const MAX_TIMEOUT_RETRIES = 1;
const MAX_RATE_LIMIT_RETRIES = 1;
const RATE_LIMIT_RETRY_DELAY = 15_000;

// Build-time cache to prevent duplicate API calls during static generation
const imageCache = new Map<string, string | null>();
// Track pending requests to prevent duplicate concurrent calls
const pendingRequests = new Map<string, Promise<string | null>>();

// Separate caches for website URL lookups
const websiteCache = new Map<string, string | null>();
const websitePendingRequests = new Map<string, Promise<string | null>>();

/**
 * Data returned from MusicBrainz artist lookup.
 */
interface MusicBrainzArtistData {
  wikidataId: string | null;
  officialHomepage: string | null;
}

let globalRateLimitUntil = 0;
let lastGlobalRateLimitLogAt = 0;

const MAX_CONCURRENT_REQUESTS = 1;
let inFlightRequests = 0;
const requestWaiters: Array<() => void> = [];
let nextAllowedRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireRequestSlot(): Promise<void> {
  if (inFlightRequests < MAX_CONCURRENT_REQUESTS) {
    inFlightRequests += 1;
    return;
  }
  await new Promise<void>((resolve) => requestWaiters.push(resolve));
  inFlightRequests += 1;
}

function releaseRequestSlot(): void {
  inFlightRequests = Math.max(0, inFlightRequests - 1);
  const next = requestWaiters.shift();
  if (next) next();
}

async function waitForNextRequestWindow(): Promise<void> {
  const now = Date.now();
  if (now < nextAllowedRequestAt) {
    await sleep(nextAllowedRequestAt - now);
  }
  nextAllowedRequestAt = Date.now() + MIN_REQUEST_INTERVAL;
}

/**
 * Step 1: Search MusicBrainz for the artist and return the MBID and matched name.
 */
export async function searchMusicBrainzArtist(
  artistName: string
): Promise<{ mbid: string; name: string } | null> {
  const encoded = encodeURIComponent(artistName);
  const url = `https://musicbrainz.org/ws/2/artist/?query=artist:${encoded}&fmt=json&limit=5`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (response.status === 503) {
    throw new Error("MusicBrainz rate limit (503)");
  }

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`);
  }

  const data: MusicBrainzArtistSearchResponse = await response.json();
  const artists = data.artists || [];

  if (artists.length === 0) return null;

  // Prefer exact case-insensitive name match, fall back to highest score
  const exactMatch = artists.find(
    (a) => a.name.toLowerCase() === artistName.toLowerCase()
  );
  const bestMatch = exactMatch || artists[0];

  return { mbid: bestMatch.id, name: bestMatch.name };
}

/**
 * Search MusicBrainz for an event (festival) by name.
 * Returns the matched event name or null if not found.
 */
export async function searchMusicBrainzEvent(
  eventName: string
): Promise<{ name: string } | null> {
  if (!eventName.trim()) return null;

  // Check global circuit breaker
  if (Date.now() < globalRateLimitUntil) return null;

  const encoded = encodeURIComponent(eventName);
  const url = `https://musicbrainz.org/ws/2/event?query=${encoded}&fmt=json&limit=5`;

  await waitForNextRequestWindow();

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (response.status === 503) {
    globalRateLimitUntil = Math.max(
      globalRateLimitUntil,
      Date.now() + GLOBAL_RATE_LIMIT_COOLDOWN
    );
    return null;
  }

  if (!response.ok) {
    console.error(`MusicBrainz event search failed: ${response.status}`);
    return null;
  }

  const data: MusicBrainzEventSearchResponse = await response.json();
  const events = data.events || [];

  if (events.length === 0) return null;

  // Prefer exact case-insensitive name match, fall back to highest score
  const exactMatch = events.find(
    (e) => e.name.toLowerCase() === eventName.toLowerCase()
  );
  const bestMatch = exactMatch || events[0];

  return { name: bestMatch.name };
}

/**
 * Step 2: Look up the artist by MBID to get URL relations (including Wikidata link and official homepage).
 */
async function lookupMusicBrainzArtist(
  mbid: string
): Promise<MusicBrainzArtistData> {
  await waitForNextRequestWindow();

  const url = `https://musicbrainz.org/ws/2/artist/${mbid}?fmt=json&inc=url-rels`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (response.status === 503) {
    throw new Error("MusicBrainz rate limit (503)");
  }

  if (!response.ok) {
    throw new Error(`MusicBrainz lookup failed: ${response.status}`);
  }

  const data: MusicBrainzArtistLookupResponse = await response.json();
  const relations = data.relations || [];

  // Extract Wikidata ID
  const wikidataRelation = relations.find((r) => r.type === "wikidata");
  let wikidataId: string | null = null;
  if (wikidataRelation) {
    // Extract entity ID from URL like "https://www.wikidata.org/wiki/Q483"
    const wikidataUrl = wikidataRelation.url.resource;
    const entityId = wikidataUrl.split("/").pop();
    wikidataId = entityId && entityId.startsWith("Q") ? entityId : null;
  }

  // Extract official homepage URL
  const homepageRelation = relations.find(
    (r) => r.type === "official homepage"
  );
  const officialHomepage = homepageRelation?.url.resource || null;

  return { wikidataId, officialHomepage };
}

/**
 * Step 3: Get the image filename from Wikidata's P18 (image) property.
 */
async function getWikidataImageFilename(
  wikidataId: string
): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Wikidata lookup failed: ${response.status}`);
  }

  const data: WikidataEntitiesResponse = await response.json();
  const entity = data.entities?.[wikidataId];
  const p18Claims = entity?.claims?.P18;

  if (!p18Claims || p18Claims.length === 0) return null;

  const filename = p18Claims[0]?.mainsnak?.datavalue?.value;
  return filename || null;
}

/**
 * Step 4: Convert a Wikimedia Commons filename to a thumbnail URL.
 */
async function getWikimediaCommonsUrl(
  filename: string,
  width = IMAGE_THUMBNAIL_WIDTH
): Promise<string | null> {
  const encoded = encodeURIComponent(filename);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encoded}&prop=imageinfo&iiprop=url&iiurlwidth=${width}&format=json`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Wikimedia Commons lookup failed: ${response.status}`);
  }

  const data: WikimediaCommonsQueryResponse = await response.json();
  const pages = data.query?.pages;
  if (!pages) return null;

  const pageId = Object.keys(pages)[0];
  if (!pageId || pageId === "-1") return null;

  const imageInfo = pages[pageId]?.imageinfo?.[0];
  return imageInfo?.thumburl || imageInfo?.url || null;
}

/**
 * Fetch a CC-licensed artist image URL via MusicBrainz → Wikidata → Wikimedia Commons.
 *
 * Returns a thumbnail URL from upload.wikimedia.org or null if no image was found.
 */
export async function getArtistImageUrl(
  artistName: string,
  retryCount = 0
): Promise<string | null> {
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_MUSICBRAINZ_IMAGES, false)) {
    return null;
  }

  if (!artistName.trim()) {
    return null;
  }

  // Global circuit breaker
  if (Date.now() < globalRateLimitUntil) {
    if (Date.now() - lastGlobalRateLimitLogAt > 10_000) {
      lastGlobalRateLimitLogAt = Date.now();
      console.warn(
        `MusicBrainz calls paused due to recent rate limiting (cooldown ends in ${Math.max(0, globalRateLimitUntil - Date.now())}ms)`
      );
    }
    return null;
  }

  const cacheKey = artistName.toLowerCase().trim();

  // Return cached result
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey) ?? null;
  }

  // Return pending request
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const requestPromise = (async (): Promise<string | null> => {
    await acquireRequestSlot();
    try {
      // Re-check circuit breaker inside slot
      if (Date.now() < globalRateLimitUntil) {
        return null;
      }

      await waitForNextRequestWindow();

      // Step 1: Search MusicBrainz for the artist
      const searchResult = await searchMusicBrainzArtist(artistName);
      if (!searchResult) {
        console.warn(
          `Artist "${artistName}" not found in MusicBrainz`
        );
        imageCache.set(cacheKey, null);
        return null;
      }

      // Step 2: Look up relations to find Wikidata ID
      const artistData = await lookupMusicBrainzArtist(searchResult.mbid);
      if (!artistData.wikidataId) {
        imageCache.set(cacheKey, null);
        return null;
      }

      // Step 3: Get image filename from Wikidata
      const filename = await getWikidataImageFilename(artistData.wikidataId);
      if (!filename) {
        imageCache.set(cacheKey, null);
        return null;
      }

      // Step 4: Get thumbnail URL from Wikimedia Commons
      const imageUrl = await getWikimediaCommonsUrl(filename);
      imageCache.set(cacheKey, imageUrl);
      return imageUrl;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      // Handle MusicBrainz rate limiting (HTTP 503)
      if (/rate limit|503/i.test(message)) {
        globalRateLimitUntil = Math.max(
          globalRateLimitUntil,
          Date.now() + GLOBAL_RATE_LIMIT_COOLDOWN
        );

        if (retryCount < MAX_RATE_LIMIT_RETRIES) {
          const backoffDelay = Math.min(
            RATE_LIMIT_RETRY_DELAY * Math.pow(2, retryCount),
            60_000
          );
          console.warn(
            `MusicBrainz rate limit for "${artistName}". Retrying after ${backoffDelay}ms...`
          );

          pendingRequests.delete(cacheKey);
          await sleep(backoffDelay);
          globalRateLimitUntil = Math.max(
            globalRateLimitUntil,
            Date.now() + backoffDelay
          );

          return getArtistImageUrl(artistName, retryCount + 1);
        }

        console.warn(
          `MusicBrainz rate limit for "${artistName}". Skipping.`
        );
        imageCache.set(cacheKey, null);
        return null;
      }

      // Handle timeouts
      if (
        /timeout|timed out|aborterror/i.test(message) ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        if (retryCount < MAX_TIMEOUT_RETRIES) {
          const retryDelay = 1000 * (retryCount + 1);
          console.warn(
            `MusicBrainz timeout for "${artistName}". Retrying after ${retryDelay}ms... (attempt ${retryCount + 1}/${MAX_TIMEOUT_RETRIES})`
          );

          pendingRequests.delete(cacheKey);
          await sleep(retryDelay);
          return getArtistImageUrl(artistName, retryCount + 1);
        }

        console.error(
          `MusicBrainz timeout for "${artistName}" after ${MAX_TIMEOUT_RETRIES} retries. Giving up.`
        );
        imageCache.set(cacheKey, null);
        return null;
      }

      console.error(
        `Error fetching MusicBrainz image for "${artistName}":`,
        error
      );
      imageCache.set(cacheKey, null);
      return null;
    } finally {
      pendingRequests.delete(cacheKey);
      releaseRequestSlot();
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Fetch an artist's official website URL via MusicBrainz.
 *
 * Returns the official homepage URL or null if not found.
 */
export async function getArtistWebsiteUrl(
  artistName: string,
  retryCount = 0
): Promise<string | null> {
  if (!isFeatureEnabled(FEATURE_FLAGS.ENABLE_MUSICBRAINZ_IMAGES, false)) {
    return null;
  }

  if (!artistName.trim()) {
    return null;
  }

  // Global circuit breaker
  if (Date.now() < globalRateLimitUntil) {
    if (Date.now() - lastGlobalRateLimitLogAt > 10_000) {
      lastGlobalRateLimitLogAt = Date.now();
      console.warn(
        `MusicBrainz calls paused due to recent rate limiting (cooldown ends in ${Math.max(0, globalRateLimitUntil - Date.now())}ms)`
      );
    }
    return null;
  }

  const cacheKey = artistName.toLowerCase().trim();

  // Return cached result
  if (websiteCache.has(cacheKey)) {
    return websiteCache.get(cacheKey) ?? null;
  }

  // Return pending request
  if (websitePendingRequests.has(cacheKey)) {
    return websitePendingRequests.get(cacheKey)!;
  }

  const requestPromise = (async (): Promise<string | null> => {
    await acquireRequestSlot();
    try {
      // Re-check circuit breaker inside slot
      if (Date.now() < globalRateLimitUntil) {
        return null;
      }

      await waitForNextRequestWindow();

      // Step 1: Search MusicBrainz for the artist
      const searchResult = await searchMusicBrainzArtist(artistName);
      if (!searchResult) {
        websiteCache.set(cacheKey, null);
        return null;
      }

      // Step 2: Look up relations to find official homepage
      const artistData = await lookupMusicBrainzArtist(searchResult.mbid);
      websiteCache.set(cacheKey, artistData.officialHomepage);
      return artistData.officialHomepage;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      // Handle MusicBrainz rate limiting (HTTP 503)
      if (/rate limit|503/i.test(message)) {
        globalRateLimitUntil = Math.max(
          globalRateLimitUntil,
          Date.now() + GLOBAL_RATE_LIMIT_COOLDOWN
        );

        if (retryCount < MAX_RATE_LIMIT_RETRIES) {
          const backoffDelay = Math.min(
            RATE_LIMIT_RETRY_DELAY * Math.pow(2, retryCount),
            60_000
          );
          console.warn(
            `MusicBrainz rate limit for "${artistName}" (website). Retrying after ${backoffDelay}ms...`
          );

          websitePendingRequests.delete(cacheKey);
          await sleep(backoffDelay);
          globalRateLimitUntil = Math.max(
            globalRateLimitUntil,
            Date.now() + backoffDelay
          );

          return getArtistWebsiteUrl(artistName, retryCount + 1);
        }

        console.warn(
          `MusicBrainz rate limit for "${artistName}" (website). Skipping.`
        );
        websiteCache.set(cacheKey, null);
        return null;
      }

      // Handle timeouts
      if (
        /timeout|timed out|aborterror/i.test(message) ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        if (retryCount < MAX_TIMEOUT_RETRIES) {
          const retryDelay = 1000 * (retryCount + 1);
          console.warn(
            `MusicBrainz timeout for "${artistName}" (website). Retrying after ${retryDelay}ms... (attempt ${retryCount + 1}/${MAX_TIMEOUT_RETRIES})`
          );

          websitePendingRequests.delete(cacheKey);
          await sleep(retryDelay);
          return getArtistWebsiteUrl(artistName, retryCount + 1);
        }

        console.error(
          `MusicBrainz timeout for "${artistName}" (website) after ${MAX_TIMEOUT_RETRIES} retries. Giving up.`
        );
        websiteCache.set(cacheKey, null);
        return null;
      }

      console.error(
        `Error fetching MusicBrainz website for "${artistName}":`,
        error
      );
      websiteCache.set(cacheKey, null);
      return null;
    } finally {
      websitePendingRequests.delete(cacheKey);
      releaseRequestSlot();
    }
  })();

  websitePendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
