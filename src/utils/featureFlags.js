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
 * @param {string} value - Environment variable value
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const normalized = String(value).toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Check if a feature flag is enabled
 * @param {string} flagName - Name of the feature flag (env var name)
 * @param {boolean} defaultValue - Default value if flag is not set
 * @returns {boolean}
 */
export function isFeatureEnabled(flagName, defaultValue = false) {
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
};
