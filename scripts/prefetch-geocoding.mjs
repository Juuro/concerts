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
    return path.join(nextCacheDir, 'geocoding.json');
  }
 
  const fallbackDir = path.join(process.cwd(), '.cache');
  safeMkdirp(fallbackDir);
  return path.join(fallbackDir, 'geocoding.json');
}
 
function getErrorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}
 
function coordKey(lat, lon) {
  const latN = typeof lat === 'number' ? lat : Number(lat);
  const lonN = typeof lon === 'number' ? lon : Number(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return '';
  // Stable key across runs; aligns with runtime lookup.
  return `${latN.toFixed(6)},${lonN.toFixed(6)}`;
}
 
function formatCoordinates(lat, lon) {
  const latN = typeof lat === 'number' ? lat : Number(lat);
  const lonN = typeof lon === 'number' ? lon : Number(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return '';
  return `${latN.toFixed(3)}, ${lonN.toFixed(3)}`;
}
 
function readExistingCache(cachePath) {
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.locations && typeof parsed.locations === 'object') {
      return parsed.locations;
    }
  } catch {
    // ignore
  }
  return null;
}
 
async function getAllConcertCoordinatesFromContentful() {
  const space = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_DELIVERY_TOKEN;
  if (!space || !accessToken) {
    throw new Error('Missing CONTENTFUL_SPACE_ID / CONTENTFUL_DELIVERY_TOKEN');
  }
 
  const client = createClient({ space, accessToken });
 
  const entries = await client.getEntries({
    content_type: 'concert',
    order: ['-fields.date'],
    limit: 1000,
  });
 
  const coords = [];
  for (const item of entries.items ?? []) {
    const fields = item.fields ?? {};
    const city = fields.city;
    const lat = city?.lat;
    const lon = city?.lon;
    const key = coordKey(lat, lon);
    if (!key) continue;
    coords.push({ key, lat: Number(lat), lon: Number(lon) });
  }
 
  // De-dup by key (stable)
  const seen = new Set();
  const unique = [];
  for (const c of coords) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    unique.push(c);
  }
  return unique;
}
 
async function fetchPhotonReverse({ baseUrl, lat, lon, timeoutMs }) {
  const url = new URL('/reverse', baseUrl);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('limit', '1');
 
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
      json = null;
    }
 
    return { status: res.status, ok: res.ok, json };
  } finally {
    clearTimeout(timeout);
  }
}
 
function normalizePhotonToGeocodingData(lat, lon, photonJson) {
  const features = Array.isArray(photonJson?.features) ? photonJson.features : [];
  const first = features[0];
  const props = first?.properties && typeof first.properties === 'object' ? first.properties : {};
 
  const city =
    props.city ||
    props.locality ||
    props.name ||
    props.county ||
    props.state ||
    '';
 
  if (typeof city === 'string' && city.trim()) {
    return {
      _normalized_city: city.trim(),
      city: typeof props.city === 'string' ? props.city : undefined,
      name: typeof props.name === 'string' ? props.name : undefined,
      country: typeof props.country === 'string' ? props.country : undefined,
      state: typeof props.state === 'string' ? props.state : undefined,
    };
  }
 
  return {
    _normalized_city: formatCoordinates(lat, lon),
    _is_coordinates: true,
  };
}
 
async function writeCache(cachePath, locations, meta) {
  const payload = {
    generatedAt: new Date().toISOString(),
    locations,
    meta,
  };
  safeMkdirp(path.dirname(cachePath));
  fs.writeFileSync(cachePath, JSON.stringify(payload), 'utf8');
  console.log(`[geocoding prefetch] Wrote cache: ${cachePath}`);
}
 
async function main() {
  // Ensure `.env` is loaded for prebuild scripts (Next loads it later).
  loadDotEnvFile();
 
  const enabled = parseBoolean(process.env.ENABLE_GEOCODING, true);
  if (!enabled) {
    console.log('[geocoding prefetch] ENABLE_GEOCODING is off; skipping.');
    return;
  }
 
  const baseUrl = process.env.PHOTON_BASE_URL || 'https://photon.komoot.io';
 
  const cachePath = getCachePath();
  const existingLocations = readExistingCache(cachePath);
  const coords = await getAllConcertCoordinatesFromContentful();
 
  console.log(`[geocoding prefetch] Fetching ${coords.length} locations -> ${cachePath}`);
 
  const MIN_INTERVAL_MS = 700; // be polite: ~1.4 req/sec
  const MAX_TRANSIENT_RETRIES = 2;
  const RATE_LIMIT_COOLDOWN_MS = 30_000;
  const REQUEST_TIMEOUT_MS = 8000;
  const MAX_TOTAL_MS = 5 * 60 * 1000; // cap duration so builds don't hang
  const startedAt = Date.now();
 
  const locations = existingLocations ? { ...existingLocations } : {};
  let lastStartAt = 0;
 
  for (let i = 0; i < coords.length; i++) {
    const { key, lat, lon } = coords[i];
 
    // Respect existing cache (avoid re-hitting the API).
    const existing = locations[key];
    const isFallback = existing && typeof existing === 'object' && existing._is_coordinates === true;
    // Re-try fallback entries (they may have been caused by a transient API error).
    if (Object.prototype.hasOwnProperty.call(locations, key) && !isFallback) {
      continue;
    }
 
    if (Date.now() - startedAt > MAX_TOTAL_MS) {
      console.warn('[geocoding prefetch] Time budget exceeded; stopping early (soft).');
      await writeCache(cachePath, locations, { stoppedEarly: true, reason: 'time_budget_exceeded' });
      return;
    }
 
    // Global pacing (prevents hammering Photon).
    const now = Date.now();
    const waitMs = Math.max(0, lastStartAt + MIN_INTERVAL_MS - now);
    if (waitMs > 0) await sleep(waitMs);
    lastStartAt = Date.now();
 
    let attempt = 0;
    while (true) {
      try {
        const { status, ok, json } = await fetchPhotonReverse({
          baseUrl,
          lat,
          lon,
          timeoutMs: REQUEST_TIMEOUT_MS,
        });

        // Rate limit: cool down and continue (soft, but try to recover).
        if (status === 429) {
          const remainingMs = Math.max(0, MAX_TOTAL_MS - (Date.now() - startedAt));
          if (remainingMs < RATE_LIMIT_COOLDOWN_MS) {
            console.warn('[geocoding prefetch] Rate limited (429) near time budget end. Stopping early (soft).');
            await writeCache(cachePath, locations, { stoppedEarly: true, reason: 'rate_limited_429' });
            return;
          }

          console.warn(`[geocoding prefetch] Rate limited (429). Cooling down ${RATE_LIMIT_COOLDOWN_MS}ms and retrying...`);
          await sleep(RATE_LIMIT_COOLDOWN_MS);
          continue;
        }

        // Transient server errors / invalid JSON: retry a couple times.
        const isServerError = status >= 500;
        const isInvalidJson = ok && json === null;
        if ((isServerError || isInvalidJson) && attempt < MAX_TRANSIENT_RETRIES) {
          attempt += 1;
          const backoffMs = 1000 * attempt;
          await sleep(backoffMs);
          continue;
        }

        // Non-OK responses: do NOT overwrite a previous good value; keep fallback only if we have nothing.
        if (!ok) {
          if (!Object.prototype.hasOwnProperty.call(locations, key)) {
            locations[key] = {
              _normalized_city: formatCoordinates(lat, lon),
              _is_coordinates: true,
            };
          }
          break;
        }

        const normalized = normalizePhotonToGeocodingData(lat, lon, json);
        locations[key] = normalized;
        break;
      } catch (err) {
        const msg = getErrorMessage(err);
        if (attempt < MAX_TRANSIENT_RETRIES && (/timeout/i.test(msg) || /ECONNRESET/i.test(msg) || /socket hang up/i.test(msg))) {
          attempt += 1;
          await sleep(1000 * attempt);
          continue;
        }

        console.warn(`[geocoding prefetch] Error for ${key}: ${msg}`);
        if (!Object.prototype.hasOwnProperty.call(locations, key)) {
          locations[key] = {
            _normalized_city: formatCoordinates(lat, lon),
            _is_coordinates: true,
          };
        }
        break;
      }
    }
 
    if ((i + 1) % 25 === 0 || i === coords.length - 1) {
      console.log(`[geocoding prefetch] Progress: ${i + 1}/${coords.length}`);
    }
  }
 
  await writeCache(cachePath, locations, { stoppedEarly: false, baseUrl });
}
 
await main().catch((err) => {
  console.warn(`[geocoding prefetch] Failed (soft): ${getErrorMessage(err)}`);
  // Soft-fail: do not throw; let build proceed without geocoding.
});

