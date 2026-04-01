import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isFeatureEnabled, FEATURE_FLAGS } from '../featureFlags';

describe('featureFlags', () => {
  describe('isFeatureEnabled', () => {
    beforeEach(() => {
      // Clear all environment variables before each test
      vi.unstubAllEnvs();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('test_isFeatureEnabled_when_env_var_true_returns_true', () => {
      vi.stubEnv('ENABLE_LASTFM', 'true');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM)).toBe(true);
    });

    it('test_isFeatureEnabled_when_env_var_1_returns_true', () => {
      vi.stubEnv('ENABLE_GEOCODING', '1');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING)).toBe(true);
    });

    it('test_isFeatureEnabled_when_env_var_yes_returns_true', () => {
      vi.stubEnv('ENABLE_LASTFM', 'yes');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM)).toBe(true);
    });

    it('test_isFeatureEnabled_when_env_var_false_returns_false', () => {
      vi.stubEnv('ENABLE_LASTFM', 'false');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM)).toBe(false);
    });

    it('test_isFeatureEnabled_when_env_var_0_returns_false', () => {
      vi.stubEnv('ENABLE_GEOCODING', '0');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING)).toBe(false);
    });

    it('test_isFeatureEnabled_when_env_var_undefined_uses_default', () => {
      // No env var set - should use default value
      expect(isFeatureEnabled('NONEXISTENT_FLAG', true)).toBe(true);
      expect(isFeatureEnabled('NONEXISTENT_FLAG', false)).toBe(false);
    });

    it('test_isFeatureEnabled_when_env_var_has_leading_trailing_whitespace_returns_true', () => {
      vi.stubEnv('ENABLE_LASTFM', '  true  ');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM)).toBe(true);
    });

    it('test_isFeatureEnabled_when_env_var_is_mixed_case_returns_parsed_boolean', () => {
      vi.stubEnv('ENABLE_LASTFM', 'TRUE');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM)).toBe(true);

      vi.stubEnv('ENABLE_GEOCODING', 'False');
      expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_GEOCODING)).toBe(false);
    });
  });
});
