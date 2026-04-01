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

**CRITICAL:** Never use production user data or real PII in test fixtures. This is a **MANDATORY** requirement for all tests.

That does **not** mean every string must be generic: recognizable **public** band, city, or venue names in fully synthetic mocks (e.g. the Last.fm and `ConcertCard` examples above) are fine—they are not personal data when they are not copied from production and do not stand in for a real individual. User-shaped fields (email, name, notes, private location tied to a persona in the test) must stay anonymized; see **Rules** (item 3).

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

### Privacy Flag Responsibility

**IMPORTANT**: Functions in `src/lib/concerts.ts` return RAW data. Privacy flag filtering (`hideLocationPublic`, `hideCostPublic`, `isPublic`) is the **CALLER'S responsibility** (API routes, components, pages).

When documenting or testing functions that return user-related data, use this JSDoc pattern:

```typescript
/**
 * Returns concerts with full location and cost data.
 *
 * **GDPR:** Caller must apply privacy flags before exposing to users:
 * - If hideLocationPublic: exclude venue, latitude, longitude
 * - If hideCostPublic: exclude cost field
 * - If !isPublic: exclude entire user data from public endpoints
 */
export async function getUserConcerts(userId: string) {
  // Raw data returned - no filtering
}
```

### Example Privacy Flag Test

When testing API routes or components that consume concerts data, verify privacy filtering:

```typescript
it('test_publicProfile_respects_hideLocationPublic', async () => {
  const user = {
    id: 'test-user-1',
    hideLocationPublic: true,
    isPublic: true
  };

  const concert = mockConcert();

  // API route should filter location fields
  const response = filterForPublicProfile(concert, user);

  expect(response.venue).toBeUndefined();
  expect(response.city.lat).toBeUndefined();
  expect(response.city.lon).toBeUndefined();
});
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
3. **Separate user data from illustrative labels**: For **users and attendance** (emails, display names, notes, venues/costs tied to a real person in the scenario), use anonymized values—e.g. "Test User", `user-*@test.example.com`, "Test Venue" when you mean a private fixture. **Public** band names, city names, or venue names that only label shared/catalog data (like examples elsewhere in this doc) are not personal data under GDPR; using recognizable names for readability is fine as long as fixtures are not copied from production and do not identify a real individual.
4. **Mock all external APIs**: No real API calls to Last.fm, Photon, MusicBrainz
5. **Public coordinates only**: Use well-known landmarks (Berlin: 52.52, 13.405)

### GDPR Compliance Checklist

Before merging tests, verify:

- [ ] Test fixtures use anonymized data (`@test.example.com` emails, mock IDs) and are not copied from production
- [ ] No PII in fixtures: no real people's names or emails, no production user rows, no data that identifies a specific natural person
- [ ] Functions that return raw user data have JSDoc documenting privacy flag responsibility
- [ ] API route tests verify privacy flag filtering (if applicable)
- [ ] No PII in test logs: log only IDs, never names/emails/locations
- [ ] No real API keys in test environment
- [ ] All external APIs mocked (Last.fm, Photon, MusicBrainz)

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

### Prisma Client Mocking (CRITICAL)

**IMPORTANT:** The Prisma client is globally mocked in `vitest.setup.ts`. Individual tests must provide realistic mock return values using `vi.mocked()`.

Mock data must include full Prisma relation types to prevent runtime errors. If your mock returns generic objects without nested relations (`bands[]`, `festival`, `attendees[]`, `_count`), tests will pass but production code will crash on property access.

#### Mock Data Factories with Full Relations

Use Prisma's `Prisma.ConcertGetPayload` utility type to ensure mock data matches production types:

```typescript
import { vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

// Mock Concert with full relations
const mockConcert = (): Prisma.ConcertGetPayload<{
  include: {
    bands: { include: { band: true } }
    festival: true
    attendees: true
    _count: { select: { attendees: true } }
  }
}> => ({
  id: 'concert-1',
  date: new Date('2025-01-01'),
  latitude: 52.5,
  longitude: 13.4,
  venue: 'Test Venue',
  normalizedCity: 'Berlin',
  isFestival: false,
  festivalId: null,
  createdById: 'test-user-1',
  updatedById: 'test-user-1',
  bands: [{
    id: 'cb-1',
    concertId: 'concert-1',
    bandId: 'band-1',
    isHeadliner: true,
    sortOrder: 0,
    band: mockBand()
  }],
  festival: null,
  attendees: [{
    id: 'uc-1',
    userId: 'test-user-1',
    concertId: 'concert-1',
    cost: '50.00',
    notes: 'Great show',
    supportingActIds: []
  }],
  _count: { attendees: 1 }
});

// Mock Band
const mockBand = (): Prisma.BandGetPayload<{}> => ({
  id: 'band-1',
  name: 'Test Band A',
  slug: 'test-band-a',
  imageUrl: null,
  imageEnrichedAt: null,
  lastfmUrl: null,
  websiteUrl: null,
  genres: [],
  bio: null,
  createdById: 'test-user-1',
  updatedById: 'test-user-1'
});

// Use in tests
it('test_getConcertById_returns_transformed_concert', async () => {
  vi.mocked(prisma.concert.findUnique).mockResolvedValue(mockConcert());

  const result = await getConcertById('concert-1');

  expect(result).toBeDefined();
  expect(result?.id).toBe('concert-1');
  expect(result?.bands[0].name).toBe('Test Band A'); // Safe property access
});
```

#### Resetting Mocks Between Tests

Always reset mocks between tests to prevent state bleeding:

```typescript
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks(); // Clears call history and mock implementations
});
```

## concerts.ts Test Patterns

The `src/lib/concerts.ts` file contains 25+ exported functions covering CRUD operations, pagination, filtering, statistics, and duplicate detection. Tests for this file should follow these patterns:

### Authorization Testing (Attendance-Based)

**CRITICAL**: Authorization checks verify **ATTENDANCE**, not ownership. In the multi-tenant model, concerts are shared entities. Authorization checks verify whether a user attended a concert before allowing updates/deletes.

```typescript
import { vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { updateConcert } from '@/lib/concerts';

it('test_updateConcert_with_non_attendee_returns_null', async () => {
  // User A attended the concert
  const attendance = {
    id: 'uc-1',
    userId: 'user-A',
    concertId: 'concert-1',
    cost: '50.00',
    notes: null,
    supportingActIds: []
  };
  vi.mocked(prisma.userConcert.findUnique).mockResolvedValue(attendance);

  // User B tries to update concert that user A attended
  const result = await updateConcert('concert-1', 'user-B', { venue: 'New Venue' });

  // This test MUST FAIL if attendance check is removed or bypassed
  expect(result).toBeNull();
});
```

**Test Coverage Requirements**:
1. Non-attendee cannot update concert (returns null)
2. Non-attendee cannot delete concert (returns false)
3. Single attendee can update concert in place
4. Multiple attendees trigger fork logic on core field changes

### Fork Logic Testing

Multi-tenant fork logic triggers when:
- Concert has multiple attendees (`_count.attendees > 1`)
- User modifies a core field (date, venue, latitude/longitude, headliner)

When fork logic triggers:
1. New concert is created with the user's changes
2. User is removed from the original concert's attendees
3. Original concert is deleted if orphaned (no remaining attendees)
4. User's cost/notes are preserved in the new concert

```typescript
it('test_updateConcert_multi_attendee_forks_on_venue_change', async () => {
  // Concert with 2 attendees
  const concert = mockConcert();
  concert._count.attendees = 2;

  vi.mocked(prisma.concert.findUnique).mockResolvedValue(concert);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
    return await callback(prisma);
  });

  // User updates venue (core field change)
  const result = await updateConcert('concert-1', 'user-A', { venue: 'New Venue' });

  // Verify fork behavior
  expect(prisma.concert.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      venue: 'New Venue'
    })
  });
  expect(prisma.userConcert.delete).toHaveBeenCalled();
});
```

### Pagination Testing

Pagination uses cursor-based logic with the format: `${date.toISOString()}_${id}`.

**Test Coverage Requirements**:
- Forward pagination (date ASC, id ASC)
- Backward pagination (date DESC, id DESC)
- Invalid cursor handling (malformed string, returns empty array)
- Limit clamping (max 100 to prevent resource exhaustion)
- Filter combinations (userId, bandSlug, city, year)

```typescript
it('test_getConcertsPaginated_forward_pagination', async () => {
  const concerts = [
    mockConcert({ id: 'c1', date: new Date('2025-01-01') }),
    mockConcert({ id: 'c2', date: new Date('2025-01-02') })
  ];

  vi.mocked(prisma.concert.findMany).mockResolvedValue(concerts);

  const result = await getConcertsPaginated({
    limit: 20,
    direction: 'forward'
  });

  expect(result.concerts).toHaveLength(2);
  expect(result.nextCursor).toBeDefined();
});
```

### Statistics Testing

Statistics functions use `unstable_cache` for performance. Tests should verify cache behavior and aggregation logic.

```typescript
it('test_getConcertStatistics_aggregates_correctly', async () => {
  const concerts = [
    mockConcert({ date: new Date('2024-01-01'), normalizedCity: 'Berlin' }),
    mockConcert({ date: new Date('2024-01-15'), normalizedCity: 'Berlin' }),
    mockConcert({ date: new Date('2025-01-01'), normalizedCity: 'Munich' })
  ];

  vi.mocked(prisma.concert.findMany).mockResolvedValue(concerts);

  const stats = await getConcertStatistics();

  // Verify top years, cities, bands
  expect(stats.topYears).toContainEqual({ year: 2024, count: 2 });
  expect(stats.topCities).toContainEqual({ city: 'Berlin', count: 2 });
});
```

### Duplicate Detection Testing

Duplicate detection uses `COORD_TOLERANCE` (0.001 degrees ≈ 100m) to match concerts by:
- Same date
- Same location (within tolerance)
- Same headliner

```typescript
it('test_findMatchingConcert_within_tolerance', async () => {
  const existingConcert = mockConcert({
    date: new Date('2025-01-01'),
    latitude: 52.5200,
    longitude: 13.4050
  });

  const newConcert = {
    date: new Date('2025-01-01'),
    latitude: 52.5205, // Within 0.001 tolerance
    longitude: 13.4055
  };

  const match = await findMatchingConcert(newConcert, 'test-user-1');

  expect(match).toBeDefined();
  expect(match?.id).toBe(existingConcert.id);
});

it('test_findMatchingConcert_outside_tolerance_returns_null', async () => {
  const existingConcert = mockConcert({
    date: new Date('2025-01-01'),
    latitude: 52.5200,
    longitude: 13.4050
  });

  const newConcert = {
    date: new Date('2025-01-01'),
    latitude: 52.5300, // Outside 0.001 tolerance
    longitude: 13.4050
  };

  const match = await findMatchingConcert(newConcert, 'test-user-1');

  expect(match).toBeNull();
});
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

- **Target**: 80% lines, 80% branches, 80% functions
- **Pure functions**: Should reach 100% coverage (easy to test)
- **Complex async logic**: 85%+ coverage (CRUD, fork logic, pagination)
- **React components**: 80%+ coverage

**Important**: Coverage thresholds in `vitest.config.ts` use `autoUpdate: true`, meaning thresholds adjust automatically based on current coverage. As the codebase grows, coverage targets will be enforced more strictly.

Focus on **branch coverage**, not just line coverage. A function with high line coverage but low branch coverage indicates missing error path or edge case tests.

## Known Limitations

These items are out of scope for unit tests and documented as tech debt for future improvement:

### Error Handling

- **Geocoding failures**: Unit tests mock successful geocoding. API-level error handling is tested in integration tests.
- **Prisma transaction deadlocks**: Unit tests mock successful transactions. Retry logic is tested in integration tests.
- **Query timeouts**: Unit tests don't use real database connections. Timeout behavior is tested in E2E tests.

### Resilience

- **Retry logic**: Not present in `concerts.ts`. Considered follow-up work.
- **Circuit breakers**: Not present. External API calls (Last.fm, Photon) should implement circuit breakers at the API client level.

### Cache Invalidation

- **`revalidateTag` behavior**: Unit tests cannot verify Next.js cache invalidation. This is tested in E2E tests by verifying page content updates after mutations.

### Observability

- **Logging**: No structured logging in `concerts.ts`. This is a HIGH priority tech debt item. Future work should add structured logging to entry/exit points of public functions:
  - Operation name (e.g., `concert.create.started`)
  - Entity IDs (concertId, userId - never names or emails)
  - Status (success/error)
  - Duration (optional)

## Coverage Requirements

### Target Coverage

- **Line coverage**: 80%
- **Branch coverage**: 80%
- **Function coverage**: 80%

Run `yarn test:coverage` and review the HTML report in `coverage/index.html` to identify uncovered lines and branches.

### Enforcement

Every exported function must have minimum **3 test cases**:

1. **Happy path**: Valid input returns expected output
2. **Error/null case**: Invalid input returns null or throws error
3. **Edge case**: Boundary condition (empty array, null values, limit bounds)

### Coverage Report Review

When reviewing coverage reports, focus on **BRANCHES**, not just lines:

- A function can have high line coverage but low branch coverage if only happy paths are tested
- The HTML report highlights untested branches in yellow/red
- Add tests for uncovered branches or document why they are unreachable

Example review checklist:

- [ ] All exported functions have ≥3 test cases
- [ ] All conditional branches (`if`/`else`) are covered
- [ ] Error paths are tested (null returns, exceptions thrown)
- [ ] Edge cases are tested (empty arrays, boundary values)
- [ ] Complex functions (fork logic, pagination) have dedicated test suites

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
