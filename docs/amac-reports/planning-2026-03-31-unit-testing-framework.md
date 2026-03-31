# AMAC Planning Report: Unit Testing Framework

**Date:** 2026-03-31  
**Stack:** TypeScript / Next.js 16  
**Branch:** feature/unit-testing-framework (from feat/multi-tenancy)  
**Confidence:** 92%  
**Re-plan:** 1 (user constraints applied)

## User Constraints Applied

1. ✅ **CRITICAL**: Use Vitest, NOT Jest (Next.js 16 compatible)
2. ✅ **CRITICAL**: Ignore Contentful (being removed)
3. ✅ **CRITICAL**: Use yarn only (never npm)
4. ✅ Keep 4 example test files approach
5. ✅ Keep TESTING.md with GDPR guidelines
6. ✅ Reference TESTING.md from CLAUDE.md
7. ✅ Mock external APIs (Last.fm, Photon)

## Specialist Debate Summary

### Agreements (High Confidence)

✅ **10 decisions agreed by 5+ specialists:**

1. Vitest is the required framework (user constraint)
2. Must mock all external APIs (Last.fm, Photon) - CRITICAL
3. 4 example test patterns: pure functions, env mocking, async/API, React components
4. Test naming: test_{function}_{condition}_{expected}
5. TESTING.md with copy-paste examples + GDPR compliance
6. Reference TESTING.md from CLAUDE.md
7. package.json scripts using yarn
8. Anonymized test data only (test@example.com, mock UUIDs)
9. Co-located __tests__/ directories
10. 80%+ coverage goal

### Conflicts Resolved

#### 1. vitest.setup.ts (Global Setup File)
- **Architect said**: Create vitest.setup.ts for jest-dom matchers and Next.js mocks
- **Pragmatist said**: Skip vitest.setup.ts - only 4 tests don't justify global setup
- **Resolution:** Skip (Pragmatist wins)
- **Reasoning:** With 4 example tests, global setup is premature. Tests import jest-dom directly. Defer until 10+ test files exist.
- **DA Challenge [MEDIUM]:** Consensus wrong - Next.js framework mocks (Image, Link) needed across ALL component tests, not just these 4. Should create vitest.setup.ts.

#### 2. lastfm.ts Test Complexity
- **Quality Engineer said**: Test 9 scenarios (rate limiting, circuit breaker, concurrent requests, cache)
- **Pragmatist said**: Focus on happy path + one error - defer advanced testing
- **Resolution:** Balanced - 5 key scenarios
- **Reasoning:** Cover critical paths without over-engineering. Circuit breaker can be tested incrementally.

#### 3. CLAUDE.md Update Scope
- **Quality Engineer said**: Add comprehensive testing section
- **Pragmatist said**: Single line reference to TESTING.md
- **Resolution:** Pragmatist wins - 2-3 line reference
- **Reasoning:** CLAUDE.md stays concise. TESTING.md is the comprehensive guide.

### Adoption Tracking

| Specialist | Adopted | Rejected | Notes |
|------------|---------|----------|-------|
| Architect | 7 | 1 | Vitest adopted (user constraint). vitest.setup.ts skipped (Pragmatist won). Config, mocking, TESTING.md adopted. |
| Quality Engineer | 7 | 2 | Vitest adopted. 5 lastfm.ts scenarios (balanced). vitest.setup.ts skipped. Naming, coverage, GDPR adopted. |
| Pragmatist | 9 | 0 | All recommendations adopted: No setup file, 4 tests, simple CLAUDE.md reference, no test utilities. |
| Resilience & Perf | 3 | 0 | Mock Last.fm and Photon adopted. lastfm.test.ts covers rate limiting. Codebase gaps out of scope. |
| Security | 0 | 1 | Wrong task analyzed (pagination bug). Security concerns covered by other agents. |
| GDPR | 3 | 0 | GDPR guidelines in TESTING.md. Anonymized data requirement. Privacy flag testing in ConcertCard tests. |

## Implementation Plan

**Files:** 7 new, 2 modified  
**Total:** 9 files

### New Files

1. **vitest.config.ts** - Vitest config for Next.js 16 + TypeScript + jsdom
2. **src/utils/__tests__/helpers.test.ts** - Pure function tests (cityToSlug, extractCityName)
3. **src/utils/__tests__/featureFlags.test.ts** - Env var mocking patterns
4. **src/utils/__tests__/lastfm.test.ts** - Async API mocking with rate limiting
5. **src/components/ConcertCard/__tests__/concertCard.test.tsx** - React component tests
6. **TESTING.md** - Comprehensive guide with GDPR compliance
7. **vitest.setup.ts** (DA recommends adding despite Pragmatist objection)

### Modified Files

1. **package.json** - Add vitest deps (^2.1.0) and yarn test scripts
2. **CLAUDE.md** - Add 2-3 line testing reference in Commands section

### Implementation Order

1. Update .gitignore (verify coverage/, add .nyc_output/ if missing)
2. Install dependencies: Add Vitest packages, run yarn install
3. Configure Vitest: Create vitest.config.ts
4. Write example tests: 4 test files in __tests__/
5. Document: Create TESTING.md
6. Update CLAUDE.md: Add testing reference
7. Verify: yarn test
8. Commit with Conventional Commits

## Quality Gates

### High Items Addressed (5)
- ✅ All functions have unit tests - 4 example files
- ✅ Tests cover happy path + errors + edge cases
- ✅ External APIs mocked (Last.fm, Photon)
- ✅ 80%+ coverage goal documented
- ✅ Descriptive test names

### Unaddressed Items
- **[M] Integration tests for API endpoints** - No API routes exist (static site). Not applicable.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Team unfamiliarity with Vitest | LOW | Vitest API is Jest-compatible. TESTING.md provides examples. |
| Test data with production PII (GDPR) | HIGH | TESTING.md GDPR section with anonymized data examples. Code review enforcement. |
| Async test flakiness | MEDIUM | All async tests use await. TESTING.md documents best practices. |
| Next.js component mocking patterns | MEDIUM | vitest.config.ts or vitest.setup.ts handles Image/Link mocks. |

## Devil's Advocate

**Verdict:** CHALLENGES_FOUND (6 challenges, highest: CRITICAL)

### CRITICAL Issues

1. **parseBoolean() is private** - Test will fail at import
   - Fix: Test only isFeatureEnabled() (public API)

2. **ConcertCard uses TransformedConcert, not Concert**
   - Fix: Import TransformedConcert from @/lib/concerts

### HIGH Severity Issues

3. vi.stubEnv() needs Vitest >= 2.1.0 (not ^2.0.0)
4. Last.fm callback mocking needs exact signature
5. .gitignore already has coverage/ - don't duplicate
6. Need vitest.setup.ts for Next.js mocks (consensus wrong)

### Concessions

- ✅ Vitest correct for Next.js 16
- ✅ 4 test patterns cover key scenarios
- ✅ Mocking external APIs CRITICAL
- ✅ GDPR anonymization well-addressed
- ✅ 80% coverage goal pragmatic
- ✅ Yarn commands correct
