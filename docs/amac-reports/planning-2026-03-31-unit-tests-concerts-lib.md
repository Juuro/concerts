# AMAC Planning Report: Unit Tests for concerts.ts

**Date:** 2026-03-31
**Stack:** TypeScript / Next.js 16
**Branch:** feature/unit-tests-concerts-lib-from-testing-framework
**Base Branch:** feature/unit-testing-framework ✅ (Vitest already configured)
**Confidence:** 87%

## Executive Summary

Implement comprehensive unit tests for `src/lib/concerts.ts` (64,182 chars, 25+ exported functions) to achieve 80% code coverage. Reuse existing Vitest configuration from `feature/unit-testing-framework` branch. Main deliverable: `src/lib/concerts.test.ts` with ~25-35 test cases covering CRUD operations, cursor-based pagination, filtering, statistics caching, spending aggregation, and edge cases.

**Key Finding:** Devil's Advocate identified critical authorization model misunderstanding - code checks ATTENDANCE (whether user attended concert), not OWNERSHIP. Tests must verify attendance-based authorization, not ownership-based.

## Specialist Debate Summary

### Agreements (High Confidence)

5/5 agents agreed on:
- **Use Vitest** as testing framework (already configured on base branch)
- **Mock Prisma globally** via `vi.mock('@/lib/prisma')` in `vitest.setup.ts`
- **Single focused test file** `src/lib/concerts.test.ts` (no premature abstraction)
- **GDPR-compliant test data** with anonymized PII (`@test.example.com` emails, mock UUIDs, generic artist names)
- **80% coverage target** (lines + branches + functions)
- **Test organization** by functional area: Utilities, CRUD, Pagination, Filtering, Statistics, Spending

### Conflicts Resolved

1. **Test organization: Separate fixture files vs inline mocks**
   - **Architect** proposed: Create `__tests__/lib/test-fixtures.ts` and `__tests__/lib/prisma-mock.ts` for reusable factories
   - **Pragmatist** proposed: Keep mock data inline in `concerts.test.ts`
   - **Resolution:** Inline mocks — **Pragmatist wins** (YAGNI principle; extract if second test file is added)
   - **Reasoning:** This is the first test file. Speculative abstraction violates YAGNI.

2. **Testing private functions**
   - **Architect** proposed: Test `parseSupportingActIds` and `bandToTransformed` explicitly
   - **Pragmatist** proposed: Skip private functions; test only exported public API
   - **Resolution:** Test only exported functions — **Pragmatist wins**
   - **Reasoning:** Private functions are NOT exported in concerts.ts. Black-box testing approach with implicit coverage is sufficient.

3. **Error handling and resilience tests**
   - **Resilience** proposed: Add tests for geocoding failures, Prisma transaction deadlocks, query timeouts
   - **Quality Engineer** proposed: Focus on CRUD, pagination, statistics per ACs; error handling is follow-up
   - **Pragmatist** proposed: Out of scope; unit tests assume mocks succeed
   - **Resolution:** Document gaps as tech debt; focus on 80% core coverage — **QE + Pragmatist win**
   - **Reasoning:** ACs don't mention error handling tests. Resilience gaps documented in TESTING.md Known Limitations.

4. **Authorization tests (CRITICAL)**
   - **Security** proposed: CRITICAL tests for `updateConcert`/`deleteConcert` non-owner scenarios that MUST FAIL if authorization removed
   - **Pragmatist** proposed: Authorization is in API routes, not concerts.ts; concerts.ts assumes valid userId
   - **Quality Engineer** confirmed: Ownership verification IS in concerts.ts (lines 901-906, 1076-1080)
   - **Resolution:** Add authorization tests — **Security + QE win** (CRITICAL priority)
   - **Reasoning:** concerts.ts DOES verify userId matches before update/delete. Security-critical for insurance app.
   - **Devil's Advocate correction:** Authorization checks ATTENDANCE (userConcert.findUnique), not ownership. Tests must use correct terminology.

5. **GDPR privacy flag testing depth**
   - **Quality Engineer** proposed: 5 explicit GDPR tests with `gdpr_flag=true` metadata for `hideLocationPublic`, `hideCostPublic`, `isPublic`
   - **Pragmatist** proposed: Flags checked at API/component level, not in concerts.ts; out of scope
   - **Security** proposed: Filtering responsibility documented in JSDoc; tests assume caller applies flags
   - **Resolution:** JSDoc + 2 demo tests — **Security compromise**
   - **Reasoning:** Privacy flags NOT enforced in concerts.ts (returns raw data). Responsibility at API route level. JSDoc clarifies; demo tests show pattern.

### Adoption Tracking

| Specialist | Adopted | Rejected | Key Notes |
|------------|---------|----------|-----------|
| **Architect** | 6 | 3 | File structure adopted. Rejected: separate test-fixtures.ts (YAGNI), prisma-mock.ts (inline), testing private functions (not exported) |
| **Quality Engineer** | 8 | 1 | All test requirements adopted: CRUD, pagination, statistics, edge cases. GDPR compliance enforced. Authorization tests CRITICAL. Rejected: 5 GDPR tests → 2 demo tests + JSDoc |
| **Pragmatist** | 5 | 0 | Scope (MEDIUM) adopted. Reuse from feature branch adopted. Inline mocks adopted. Skip private functions adopted. Complexity warnings addressed |
| **Resilience & Perf** | 1 | 5 | Geocoding mock adopted. Rejected: error handling tests, transaction deadlock tests, query timeout tests, retry logic, idempotency (all out of scope; documented as Known Limitations) |
| **Security** | 4 | 2 | Authorization tests adopted (CRITICAL). Test data anonymization adopted. JSDoc privacy docs adopted. Cursor validation adopted. Rejected: SQL injection tests (Prisma parameterizes), unbounded array tests (not exported) |

## Implementation Plan

### Files (6 planned → 2 actual work)

**CREATE (2 actual):**
1. **`src/lib/concerts.test.ts`** (~1,200 lines)
   - Comprehensive test suite for all 25+ exported functions
   - Organized by functional area (Utilities, CRUD, Pagination, Filtering, Statistics, Spending, Edge Cases)
   - Uses `vi.mocked(prisma)` for mocking
   - Anonymized GDPR-compliant test data
   - Authorization tests for attendance verification
   - JSDoc documenting privacy flag filtering responsibility
   - Test naming: `test_{function}_{condition}_{expected}`

2. **`TESTING.md`** (~200 lines)
   - Testing guidelines: Vitest setup, running tests, mocking patterns
   - Prisma client mocking with full relation types
   - External API mocking (getGeocodingData, cityToSlug)
   - GDPR compliance: test data anonymization, privacy flags
   - concerts.ts test patterns: authorization, pagination, statistics
   - Known Limitations: error handling gaps, resilience deferred

**EXTEND (1):**
3. **`vitest.setup.ts`** (add ~30 lines)
   - Extend existing setup to mock Prisma client: `vi.mock('@/lib/prisma')`
   - Mock external utilities: `@/utils/data` (getGeocodingData), `@/utils/helpers` (cityToSlug)
   - Keep existing Next.js component mocks (next/image, next/link)

**MODIFY (1):**
4. **`CLAUDE.md`** (add 1 line)
   - Add reference: "See TESTING.md for writing tests, mocking patterns, and GDPR compliance guidelines"

**ALREADY COMPLETE (2):**
5. **`vitest.config.ts`** ✅ EXISTS (no changes needed)
   - Already configured with TypeScript, jsdom, coverage thresholds, @vitest/ui
6. **`package.json`** ✅ COMPLETE (no changes needed)
   - Vitest dependencies already added: vitest@2.1.8, @vitest/ui@2.1.8, @vitest/coverage-v8@2.1.8, jsdom@25.0.1
   - Test scripts already present: `test`, `test:watch`, `test:coverage`

### Implementation Order

1. ✅ **DONE**: Copy vitest.config.ts from feature branch (already on correct branch)
2. ✅ **DONE**: Update package.json with Vitest dependencies (already present)
3. **TODO**: Extend vitest.setup.ts to mock Prisma client and external utilities
4. **TODO**: Write src/lib/concerts.test.ts with ~25-35 test cases
   - Utilities (getStartOfToday): 1 test
   - CRUD (create/update/delete/getById): 10 tests including fork logic
   - Queries (getBy*, getAll*): 7 tests
   - Pagination (getConcertsPaginated): 8 tests (cursor logic, bidirectional, filters)
   - Filtering (by band/city/year/user): 4 tests
   - Statistics (caching with unstable_cache): 3 tests
   - Spending (aggregation): 3 tests
   - Edge cases (duplicate detection, null handling, tolerance): 5 tests
5. **TODO**: Run `yarn test:coverage` to verify 80% threshold
6. **TODO**: Write TESTING.md with patterns and GDPR guidelines
7. **TODO**: Update CLAUDE.md reference to TESTING.md

### Key Functions to Test

**Authorization Tests (CRITICAL):**
- `test_updateConcert_non_attendee_returns_null` — User who did NOT attend cannot edit (Security requirement)
- `test_deleteConcert_non_attendee_returns_false` — User who did NOT attend cannot delete
- `test_updateConcert_single_attendee_updates_in_place` — Sole attendee modifies shared concert
- `test_updateConcert_multi_attendee_forks_on_core_change` — Attendee editing multi-attendee concert creates fork

**Fork Logic Tests (HIGH - Devil's Advocate critical gap):**
- `test_fork_creates_new_concert_and_removes_from_original` — Fork transaction atomicity
- `test_fork_preserves_user_cost_and_notes` — User-specific data migrated
- `test_fork_deletes_original_if_orphaned` — Cleanup when last attendee leaves
- `test_fork_keeps_original_if_other_attendees` — Original preserved for remaining attendees
- `test_fork_calls_getGeocodingData_for_new_location` — External dependency mocked

**Pagination Tests:**
- `test_getConcertsPaginated_forward_cursor_pagination` — Date ASC, id ASC
- `test_getConcertsPaginated_backward_cursor_pagination` — Date DESC, id DESC
- `test_getConcertsPaginated_with_cursor_includes_cursor_concert` — Cursor concert included (not skip:1)
- `test_getConcertsPaginated_with_bandSlug_filter` — Headliner filtering

**Statistics & Caching:**
- `test_getConcertStatistics_uses_cache` — unstable_cache wrapper verified
- `test_getUserTotalSpent_aggregates_cost` — Spending aggregation from UserConcert.cost

**Edge Cases:**
- `test_findMatchingConcert_within_tolerance` — Coordinate tolerance (0.001 degrees)
- `test_createConcert_with_existing_match_links_user` — Deduplication logic

## Quality Gates

### Critical Items Addressed (5)

✅ **GDPR**: Test data uses anonymized PII (`test-user-@test.example.com`, mock UUIDs, generic artist names)
✅ **Security**: Authorization tests for attendance verification (MUST FAIL if checks removed)
✅ **Testing**: Comprehensive coverage of 25+ exported functions targeting 80% (lines + branches + functions)
✅ **Testing**: Prisma client mocked globally in vitest.setup.ts, no real database access
✅ **Security**: JSDoc documenting privacy flag filtering responsibility (not enforced in concerts.ts)

### High Items Addressed (7)

✅ **Testing**: CRUD operations tested (create with deduplication, update with fork logic, delete)
✅ **Testing**: Pagination tested (cursor-based, bidirectional, filters by user/band/city/year)
✅ **Testing**: Statistics tested (caching via unstable_cache)
✅ **Testing**: Spending aggregation tested
✅ **Testing**: Edge cases tested (duplicate detection, null handling, coordinate tolerance)
✅ **Naming**: Test names follow `test_{function}_{condition}_{expected}` pattern
✅ **Error Handling**: ConcertAlreadyExistsError tested

### Unaddressed Items (4 - documented as Known Limitations)

⚠️ **Resilience**: Geocoding failure handling (concerts.ts doesn't handle failures; API routes do)
⚠️ **Resilience**: Prisma transaction deadlock retry logic (unit tests mock successful transactions)
⚠️ **Resilience**: Database query timeouts (unit tests don't use real DB)
⚠️ **Observability**: No logging in concerts.ts (tech debt documented in TESTING.md)

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Prisma mock complexity**: Raw SQL queries ($queryRaw) in statistics functions difficult to mock | MEDIUM | Use `vi.spyOn(prisma, '$queryRaw')` to verify query structure, not simulate SQL logic. Acceptable for 80% target. |
| **Authorization test brittleness**: Tests for non-attendee scenarios could pass with wrong mock data | HIGH | Explicit userId mismatch assertions. Comments: "This test fails if line 787 attendance check is removed." |
| **GDPR compliance**: Test data with production PII could leak in CI logs | HIGH | Code review checklist: Verify all fixtures use @test.example.com, mock UUIDs, generic names. NO production data. |
| **Coverage gaming**: 80% achieved by testing happy paths only, missing error branches | MEDIUM | Include edge cases: null handling, empty arrays, invalid cursors, tolerance boundaries. QE review coverage report. |
| **Fork logic gaps**: Most complex function (135 lines) could be undertested | HIGH | Add 5 CRITICAL fork tests (per Devil's Advocate DA3). Verify transaction atomicity, data migration, orphan cleanup. |

## Devil's Advocate

**Verdict:** CHALLENGES_FOUND
**Highest Severity:** CRITICAL (1 resolved, 1 active)

### Resolved Challenges

✅ **DA1 [CRITICAL]**: Missing Vitest setup
   - **Challenge**: Plan assumed vitest.config.ts/vitest.setup.ts could be copied from feature/unit-testing-framework branch, but package.json had zero Vitest dependencies
   - **Evidence**: Original package.json had no vitest deps
   - **Resolution**: Switched to feature/unit-testing-framework branch — Vitest configuration complete (vitest@2.1.8, @vitest/ui, @vitest/coverage-v8, jsdom, test scripts)
   - **Status**: RESOLVED ✅

### Active Critical Challenges

⚠️ **DA2 [CRITICAL]**: Authorization model misunderstood
   - **Challenge**: Tests check "ownership" but code checks ATTENDANCE. Multi-tenant model allows any attendee to update (triggers fork if multi-attendee)
   - **Evidence**: `concerts.ts` lines 786-793 check `userConcert.findUnique({ where: { userId_concertId }})` (attendance), NOT concert ownership. Line 830: multi-attendee edits trigger fork.
   - **Impact**: Security tests will verify wrong authorization semantics
   - **Fix**: Rename tests to 'non-attendee' (not 'non-owner'). Add fork tests: single-attendee updates in place, multi-attendee triggers fork on core field changes
   - **Status**: MUST ADDRESS in implementation

### High Severity Challenges

⚠️ **DA3 [HIGH]**: Fork logic not explicitly tested
   - **Challenge**: `forkConcertForUser` (135 lines, most complex function) missing from test plan. Fork is #1 multi-tenant bug source.
   - **Evidence**: concerts.ts lines 626-760; synthesised-plan lists 10 test functions, NONE test fork explicitly
   - **Fix**: Add 5 CRITICAL fork tests (create, preserve cost/notes, delete orphan, keep if attendees, geocoding)

⚠️ **DA4 [HIGH]**: Coverage gaming possible
   - **Challenge**: 80% coverage achievable by testing happy paths only (10 lines of assertions, 400+ lines untested branches)
   - **Fix**: Enforce 3 tests per function (happy/error/edge), require branch coverage review as blocking gate

⚠️ **DA5 [HIGH]**: Mock data shapes not specified
   - **Challenge**: If mocks return generic objects without nested relations (bands[], festival, attendees[]), tests pass but production crashes
   - **Fix**: Document mock factories with full Prisma relation types: `Prisma.$ConcertGetPayload<{include: {bands: {include: {band: true}}, festival: true, attendees: true}}>`

### Medium/Low Challenges

⚠️ **DA6 [MEDIUM]**: TESTING.md premature for single test file (YAGNI violation)
⚠️ **DA7 [MEDIUM]**: "MUST FAIL" authorization requirement not enforced (aspirational, not verified)
⚠️ **DA8 [LOW]**: `getUserTotalSpentCached` (cache wrapper) not tested, only base function

### Concessions (Devil's Advocate Agrees)

✅ Vitest is correct framework choice for Next.js 16
✅ Inline mocks (no separate test-fixtures.ts) - Pragmatist wins on YAGNI
✅ Test only exported functions (black-box approach)
✅ Functional test organization (CRUD, Pagination, Statistics, etc.)
✅ vi.mocked(prisma) follows Vitest best practices
✅ 80% threshold reasonable IF branch coverage verified
✅ GDPR-compliant anonymized test data (@test.example.com)

## Context7 Lookups Required

**During Implementation:**
1. **vitest** — mocking Prisma client with TypeScript, vi.mock() patterns, beforeEach setup
   - Used in: `vitest.setup.ts`, `src/lib/concerts.test.ts`
2. **@vitest/ui** — watch mode and coverage UI configuration
   - Used in: `vitest.config.ts`

## Next Steps

1. Extend `vitest.setup.ts` to mock Prisma client
2. Write `src/lib/concerts.test.ts` with focus on:
   - **CRITICAL**: Fix authorization terminology (attendance, not ownership)
   - **CRITICAL**: Add fork logic tests (5 tests per DA3)
   - **HIGH**: Specify mock data shapes with full Prisma types (per DA5)
   - **HIGH**: Enforce branch coverage review (per DA4)
3. Run `yarn test:coverage` and verify 80% threshold
4. Document patterns in TESTING.md with GDPR compliance section
5. Update CLAUDE.md reference

## Estimated Effort

- Setup (extend vitest.setup.ts): 20 min
- Mock data creation: 20 min
- Test writing (~1,200 lines): 120 min
- Debugging (Prisma mocks, coverage): 30 min
- Documentation (TESTING.md): 30 min
- **Total**: ~3.5 hours

---

**Report generated:** 2026-03-31
**AMAC version:** 2.0.0
**Specialists consulted:** 5 (Architect, Quality Engineer, Pragmatist, Resilience & Performance, Security Specialist)
**Tech Lead synthesis:** Opus
**Devil's Advocate review:** Sonnet
