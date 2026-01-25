import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from 'contentful';

function loadDotEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeMkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getCachePath() {
  const nextCacheDir = path.join(process.cwd(), '.next', 'cache');
  if (fs.existsSync(path.join(process.cwd(), '.next'))) {
    safeMkdirp(nextCacheDir);
    return path.join(nextCacheDir, 'lastfm-artists.json');
  }

  const fallbackDir = path.join(process.cwd(), '.cache');
  safeMkdirp(fallbackDir);
  return path.join(fallbackDir, 'lastfm-artists.json');
}

function normalizeKey(name) {
  return String(name ?? '').toLowerCase().trim();
}

function getErrorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

function getLastFmErrorCode(err) {
  const msg = getErrorMessage(err);
  const match = msg.match(/\(Code\s+(\d+)\)/i) ?? msg.match(/Code\s+(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function readExistingCache(cachePath) {
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.artists && typeof parsed.artists === 'object') {
      return parsed.artists;
    }
  } catch {
    // ignore
  }
  return null;
}

async function getAllBandNamesFromContentful() {
  const space = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_DELIVERY_TOKEN;
  if (!space || !accessToken) {
    throw new Error('Missing CONTENTFUL_SPACE_ID / CONTENTFUL_DELIVERY_TOKEN');
  }

  const client = createClient({ space, accessToken });

  const entries = await client.getEntries({
    content_type: 'band',
    order: ['fields.name'],
    limit: 1000,
  });

  const names = [];
  for (const item of entries.items ?? []) {
    const fields = item.fields ?? {};
    const slug = fields.slug;
    if (slug === 'data-schema') continue;
    const name = fields.name;
    if (typeof name === 'string' && name.trim()) names.push(name.trim());
  }

  return Array.from(new Set(names));
}

async function fetchArtistInfo(apiKey, name, { timeoutMs }) {
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'artist.getinfo');
  url.searchParams.set('artist', name);
  url.searchParams.set('autocorrect', '1');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Unable to parse API response to JSON');
    }

    if (json?.error) {
      const code = json.error;
      const message = json.message || 'Last.fm error';
      throw new Error(`${message} (Code ${code})`);
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function mapToCacheShape(lastfmResponse) {
  const artistData = lastfmResponse?.artist;
  if (!artistData) return null;

  const images = Array.isArray(artistData.image) ? artistData.image : [];
  const imageUrls = {
    small: null,
    medium: null,
    large: null,
    extralarge: null,
    mega: null,
  };

  for (const img of images) {
    const size = img?.size;
    const url = img?.['#text'] || img?.url || null;
    if (!size || !url) continue;
    if (size === 'small') imageUrls.small = url;
    else if (size === 'medium') imageUrls.medium = url;
    else if (size === 'large') imageUrls.large = url;
    else if (size === 'extralarge') imageUrls.extralarge = url;
    else if (size === 'mega') imageUrls.mega = url;
  }

  const tags = artistData?.tags?.tag ?? [];
  const genres = Array.isArray(tags)
    ? tags
        .map((t) => (typeof t === 'string' ? t : t?.name))
        .filter((g) => typeof g === 'string' && g.trim())
    : [];

  return {
    name: artistData.name,
    url: artistData.url,
    images: imageUrls,
    genres,
    bio: artistData?.bio?.summary ?? null,
  };
}

async function main() {
  // Ensure `.env` is loaded for prebuild scripts (Next loads it later).
  loadDotEnvFile();

  const enabled = parseBoolean(process.env.ENABLE_LASTFM, false);
  if (!enabled) {
    console.log('[lastfm prefetch] ENABLE_LASTFM is off; skipping.');
    return;
  }

  if (!process.env.LASTFM_API_KEY) {
    console.warn('[lastfm prefetch] Missing LASTFM_API_KEY; skipping.');
    return;
  }

  const apiKey = process.env.LASTFM_API_KEY;

  const cachePath = getCachePath();
  const existingArtists = readExistingCache(cachePath);
  const bandNames = await getAllBandNamesFromContentful();

  console.log(`[lastfm prefetch] Fetching ${bandNames.length} artists -> ${cachePath}`);

  const MIN_INTERVAL_MS = 700; // ~1.4 req/sec (polite but not painfully slow)
  const MAX_TIMEOUT_RETRIES = 1;
  const REQUEST_TIMEOUT_MS = 8000;
  const MAX_TOTAL_MS = 5 * 60 * 1000; // cap prefetch duration so builds don't hang
  const startedAt = Date.now();

  const artists = existingArtists ? { ...existingArtists } : {};
  let lastStartAt = 0;

  for (let i = 0; i < bandNames.length; i++) {
    const name = bandNames[i];
    const key = normalizeKey(name);
    if (!key) continue;

    // Respect existing cache (avoid re-hitting the API).
    if (Object.prototype.hasOwnProperty.call(artists, key)) {
      continue;
    }

    if (Date.now() - startedAt > MAX_TOTAL_MS) {
      console.warn('[lastfm prefetch] Time budget exceeded; stopping early (soft).');
      await writeCache(cachePath, artists, { stoppedEarly: true, reason: 'time_budget_exceeded' });
      return;
    }

    // Start pacing (prevents API hammering).
    const now = Date.now();
    const waitMs = Math.max(0, lastStartAt + MIN_INTERVAL_MS - now);
    if (waitMs > 0) await sleep(waitMs);
    lastStartAt = Date.now();

    let attempt = 0;
    while (true) {
      try {
        const res = await fetchArtistInfo(apiKey, name, { timeoutMs: REQUEST_TIMEOUT_MS });
        artists[key] = mapToCacheShape(res);
        break;
      } catch (err) {
        const msg = getErrorMessage(err);
        const code = getLastFmErrorCode(err);

        // Not found / invalid resource: cache null, continue.
        if (code === 6 || code === 7 || /could not be found/i.test(msg) || /\bnot found\b/i.test(msg)) {
          artists[key] = null;
          break;
        }

        // Invalid/suspended key: soft-fail by stopping further calls.
        if (code === 10 || code === 26) {
          console.warn(`[lastfm prefetch] API key error (code ${code}). Stopping prefetch early.`);
          return writeCache(cachePath, artists, { stoppedEarly: true, reason: `api_key_${code}` });
        }

        // Rate limit: cool down and continue (no endless retries).
        if (code === 29 || /rate\\s*limit/i.test(msg)) {
          console.warn('[lastfm prefetch] Rate limited (code 29). Stopping early to avoid clogging the API.');
          artists[key] = null;
          await writeCache(cachePath, artists, { stoppedEarly: true, reason: 'rate_limited' });
          return;
        }

        // Timeout-ish: one retry, then give up (soft-fail).
        if (/timeout/i.test(msg) || /timed out/i.test(msg) || /ECONNRESET/i.test(msg) || /socket hang up/i.test(msg)) {
          if (attempt < MAX_TIMEOUT_RETRIES) {
            attempt += 1;
            await sleep(1000);
            continue;
          }
          artists[key] = null;
          break;
        }

        // Unknown error: soft-fail this artist.
        console.warn(`[lastfm prefetch] Error for "${name}": ${msg}`);
        artists[key] = null;
        break;
      }
    }

    if ((i + 1) % 25 === 0 || i === bandNames.length - 1) {
      console.log(`[lastfm prefetch] Progress: ${i + 1}/${bandNames.length}`);
    }
  }

  await writeCache(cachePath, artists, { stoppedEarly: false });
}

async function writeCache(cachePath, artists, meta) {
  const payload = {
    generatedAt: new Date().toISOString(),
    artists,
    meta,
  };
  safeMkdirp(path.dirname(cachePath));
  fs.writeFileSync(cachePath, JSON.stringify(payload), 'utf8');
  console.log(`[lastfm prefetch] Wrote cache: ${cachePath}`);
}

main().catch((err) => {
  console.warn(`[lastfm prefetch] Failed (soft): ${getErrorMessage(err)}`);
  // Soft-fail: do not throw; let build proceed without Last.fm.
});

