# Testing Guide

This document provides guidelines for writing and running tests in the concerts Next.js application.

## Running Tests

```bash
# Run all tests once (CI mode)
yarn test

# Run tests in watch mode (development)
yarn test:watch

# Generate coverage report
yarn test:coverage
```

Coverage reports are saved to `coverage/` directory (HTML and JSON). Open `coverage/index.html` in your browser to view detailed coverage.

## Writing Tests

### Test File Structure

Tests are co-located with source code in `__tests__/` directories:

```
src/
  utils/
    helpers.ts
    __tests__/
      helpers.test.ts
  components/
    ConcertCard/
      concertCard.tsx
      __tests__/
        concertCard.test.tsx
```

### Test Naming Convention

Use descriptive test names following this pattern: `test_{function}_{condition}_{expected}`

```typescript
it('test_cityToSlug_valid_input_converts_to_kebab_case', () => {
  expect(cityToSlug('New York')).toBe('new-york');
});
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('moduleName', () => {
  describe('functionName', () => {
    it('test_functionName_condition_expected', () => {
      // Arrange
      const input = 'test input';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

## Testing Patterns

### 1. Pure Functions (No Mocking)

Pure functions are the easiest to test - no mocking needed.

```typescript
// src/utils/__tests__/helpers.test.ts
import { cityToSlug } from '../helpers';

it('test_cityToSlug_special_characters_removed', () => {
  expect(cityToSlug('São Paulo')).toBe('so-paulo');
  expect(cityToSlug('Berlin!')).toBe('berlin');
});
```

**Example:** `src/utils/__tests__/helpers.test.ts`

### 2. Environment Variables

Mock `process.env` using `vi.stubEnv()`:

```typescript
import { vi, beforeEach, afterEach } from 'vitest';
import { isFeatureEnabled, FEATURE_FLAGS } from '../featureFlags';

describe('featureFlags', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('test_isFeatureEnabled_when_env_var_true_returns_true', () => {
    vi.stubEnv('ENABLE_LASTFM', 'true');
    expect(isFeatureEnabled(FEATURE_FLAGS.ENABLE_LASTFM)).toBe(true);
  });
});
```

**Important:** Requires Vitest >= 2.1.0 for `vi.stubEnv()` support.

**Example:** `src/utils/__tests__/featureFlags.test.ts`

### 3. External API Calls

**CRITICAL: All external APIs MUST be mocked.** Never make real API calls in tests.

Mock entire modules using `vi.mock()`:

```typescript
import { vi } from 'vitest';

// Mock the external library
vi.mock('lastfm-ts-api', () => ({
  LastFMArtist: vi.fn().mockImplementation((apiKey: string) => ({
    getInfo: vi.fn((params, callback) => {
      callback(null, {
        name: params.artist,
        url: 'https://www.last.fm/music/MockBand',
        image: [{ size: 'large', '#text': 'https://example.com/mock.jpg' }],
      });
    }),
  })),
}));

it('test_getArtistInfo_successful_response_returns_data', async () => {
  vi.stubEnv('ENABLE_LASTFM', 'true');
  vi.stubEnv('LASTFM_API_KEY', 'test-api-key');

  const result = await getArtistInfo('Radiohead');

  expect(result).toEqual({
    name: 'Radiohead',
    url: expect.stringContaining('last.fm'),
    image: expect.any(String),
  });
});
```

**Example:** `src/utils/__tests__/lastfm.test.ts`

#### Last.fm API Mocking (Special Case)

The `lastfm-ts-api` library uses **callback-based API**. Mock MUST replicate the exact callback signature:

```typescript
getInfo: vi.fn((params: { artist: string; autocorrect?: 0 | 1 }, callback: (err: any, res: any) => void) => {
  // Success case
  callback(null, mockResponse);

  // Error case
  // callback(new Error('API Error'), null);
})
```

Test both error and success callbacks to verify the Promise wrapper logic works correctly.

### 4. React Components

Use React Testing Library with `render()` and `screen` queries:

```typescript
import { render, screen } from '@testing-library/react';
import ConcertCard from '../concertCard';
import type { TransformedConcert } from '@/lib/concerts';

it('test_ConcertCard_renders_band_name', () => {
  const mockConcert: TransformedConcert = {
    id: 'test-id',
    date: '2024-06-15T19:00:00.000Z',
    bands: [{
      id: 'band-1',
      name: 'Radiohead',
      slug: 'radiohead',
      url: '/band/radiohead',
    }],
    // ... other required fields
  };

  render(<ConcertCard concert={mockConcert} />);

  const bandLink = screen.getByRole('link', { name: 'Radiohead' });
  expect(bandLink).toBeInTheDocument();
});
```

**Example:** `src/components/ConcertCard/__tests__/concertCard.test.tsx`

#### Type Imports for Component Tests

**IMPORTANT:** `ConcertCard` uses `TransformedConcert` from `@/lib/concerts` - do NOT use `Concert` from `@/types/concert` for mocks. The types have different shapes.

```typescript
// ✅ Correct
import type { TransformedConcert } from '@/lib/concerts';

// ❌ Wrong
import type { Concert } from '@/types/concert';
```

#### Next.js Component Mocking

Next.js `Image` and `Link` components are automatically mocked in `vitest.setup.ts`. No additional setup needed in test files.

## GDPR Compliance in Tests

**CRITICAL:** Never use production user data or real PII in test fixtures.

### Anonymized Test Data Examples

```typescript
// ✅ Good - Anonymized test data
const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000', // Mock UUID
  email: 'test-user-1@test.example.com',      // Test domain
  name: 'Test User',                           // Generic name
};

const mockConcert = {
  id: 'concert-test-1',
  venue: 'Test Venue',                         // Generic venue
  city: { lat: 52.52, lon: 13.405 },          // Berlin coordinates (public)
};

// ❌ Bad - Real production data
const mockUser = {
  email: 'sebastian@posteo.de',               // Real email - GDPR violation!
  name: 'Sebastian Engel',                     // Real name - GDPR violation!
};
```

### API Key Handling

```typescript
// ✅ Good - Mock API keys
vi.stubEnv('LASTFM_API_KEY', 'test-api-key-12345');

// ❌ Bad - Real API key
vi.stubEnv('LASTFM_API_KEY', process.env.LASTFM_API_KEY);
```

### Rules

1. **Always use test email domains**: `test.example.com`, `example.com`
2. **Use mock UUIDs**: `550e8400-e29b-41d4-a716-446655440000` (not production UUIDs)
3. **Generic names**: "Test User", "Test Band", "Test Venue"
4. **Mock all external APIs**: No real API calls to Last.fm, Photon, MusicBrainz
5. **Public coordinates only**: Use well-known landmarks (Berlin: 52.52, 13.405)

## Mocking Strategies

### Module Mocking with vi.mock()

```typescript
vi.mock('../external-service', () => ({
  functionName: vi.fn().mockResolvedValue('mocked result'),
}));
```

### Environment Variable Mocking

```typescript
vi.stubEnv('ENV_VAR_NAME', 'value');
vi.unstubAllEnvs(); // Clean up in afterEach
```

### Prisma Client Mocking (for future API route tests)

```typescript
vi.mock('@/lib/prisma', () => ({
  prisma: {
    concert: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(mockConcert),
    },
  },
}));
```

## Common Gotchas

### 1. Async Tests

Always use `async/await` for async tests:

```typescript
// ✅ Good
it('test_async_function', async () => {
  const result = await asyncFunction();
  expect(result).toBe('value');
});

// ❌ Bad - will pass even if promise rejects
it('test_async_function', () => {
  asyncFunction().then(result => {
    expect(result).toBe('value');
  });
});
```

### 2. jsdom Limitations

jsdom is not a real browser. Some APIs don't work:
- `window.matchMedia` - mock it in vitest.setup.ts if needed
- `IntersectionObserver` - mock or use `@testing-library/react` with waitFor
- Canvas/WebGL - not supported

For components using MapLibre GL or complex DOM APIs, consider integration tests with real browser (Playwright).

### 3. Module State Between Tests

If testing modules with module-level state (caches, singletons), reset between tests:

```typescript
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules(); // Clear module cache
  vi.clearAllMocks(); // Clear mock call history
});
```

### 4. Next.js-Specific Patterns

**Server Components:** Cannot be tested with React Testing Library (they run on server). Test the data fetching functions separately from the component rendering.

```typescript
// Test data fetching
it('test_getConcertsByBand_filters_correctly', async () => {
  const concerts = await getConcertsByBand('radiohead');
  expect(concerts).toHaveLength(5);
});
```

**Client Components:** Use `'use client'` directive - test normally with React Testing Library.

## Coverage Goals

- **New code**: Aim for 80%+ line coverage
- **Pure functions**: Should reach 100% coverage
- **Complex async logic**: 85%+ coverage
- **React components**: 80%+ coverage

Coverage thresholds are enforced in `vitest.config.ts`. Tests will fail if coverage drops below 80%.

## Troubleshooting

### "vi.stubEnv is not a function"

Upgrade to Vitest >= 2.1.0:
```bash
yarn add -D vitest@^2.1.0
```

### "Cannot find module '@/lib/concerts'"

Check `vitest.config.ts` has correct path alias:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Tests timing out

Increase timeout in `vitest.config.ts`:
```typescript
test: {
  testTimeout: 10000, // 10 seconds
}
```

Or per-test:
```typescript
it('slow test', async () => {
  // test code
}, { timeout: 20000 });
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
- [Testing Library Queries Cheatsheet](https://testing-library.com/docs/react-testing-library/cheatsheet/)
