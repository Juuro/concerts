/**
 * Feature flags utility for Next.js
 * 
 * Feature flags are controlled via environment variables.
 * For static generation, flags are evaluated at build time.
 * 
 * Usage:
 *   import { isFeatureEnabled, FEATURE_FLAGS } from '@/utils/featureFlags'
 *   
 *   if (isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM)) {
 *     // Last.fm feature code
 *   }
 */

/**
 * Parse boolean environment variable
 */
function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const normalized = String(value).toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Check if a feature flag is enabled
 * @param flagName - Name of the feature flag (env var name)
 * @param defaultValue - Default value if flag is not set
 * @returns boolean
 */
export function isFeatureEnabled(flagName: string, defaultValue = false): boolean {
  // In Next.js, server-side env vars are available via process.env
  const value = process.env[flagName];
  return parseBoolean(value, defaultValue);
}

/**
 * Feature flag definitions (for documentation and type safety)
 */
export const FEATURE_FLAGS = {
  ENABLE_LASTFM: 'ENABLE_LASTFM',
  ENABLE_GEOCODING: 'ENABLE_GEOCODING',
  ENABLE_MUSICBRAINZ_IMAGES: 'ENABLE_MUSICBRAINZ_IMAGES',
} as const;
