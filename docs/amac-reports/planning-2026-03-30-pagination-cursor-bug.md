# AMAC Planning Report: Pagination Cursor Bug Fix

**Date:** 2026-03-30
**Stack:** TypeScript / Next.js 16
**Branch:** feature/fix-pagination-cursor-bug
**Confidence:** 92%

## Specialist Debate Summary

### Agreements (High Confidence)

**8/8 agents agreed:**
- Root cause: `getConcertsPaginated()` with cursor uses `skip:1`, causing empty results when cursor is near end
- Fix location: `src/lib/concerts.ts` lines 1233, 1472
- Solution: Remove `skip:1`, include cursor concert, fetch bidirectionally
- No API breaking changes
- No database migrations needed
- No GDPR risks introduced
- AC2 (Load earlier button) dependent on AC1 - automatically works once array is populated

**5-6/8 agents agreed:**
- Need error handling in GET `/api/concerts` route
- Need input validation for `limit` and `direction` parameters
- Need unit tests for cursor positioning logic

### Conflicts Resolved

**1. Implementation Scope**
- **Architect**: Fix cursor logic + comprehensive tests
- **Quality Engineer**: 7 unit + 4 integration + 2 E2E tests + error handling + JSDoc + input validation
- **Pragmatist**: Just fix cursor logic, 2 files, 35 lines, manual verification
- **Resilience**: Fix + error handling + retry + timeouts + monitoring
- **Resolution:** PHASED APPROACH
  - Phase 1 (this PR): Fix cursor logic + basic error handling + 3 minimal unit tests
  - Phase 2 (follow-up): Comprehensive test suite, advanced resilience, monitoring
- **Reasoning:** Critical priority demands immediate fix. Test infrastructure setup and circuit breakers shouldn't block deployment.

**2. Error Handling Requirements**
- **Quality Engineer**: MUST add try-catch to prevent 500s with stack traces
- **Resilience**: MUST add try-catch + custom errors + retry + timeouts + Sentry
- **Pragmatist**: Minimal error handling, don't over-engineer
- **Security**: Existing is safe, no new vectors
- **Resolution:** Add try-catch in `getConcertsPaginated()` and GET route. Defer advanced retry/circuit breaker.
- **Reasoning:** QE wins on Critical checklist item [3.C]. Resilience SHOULD items deferred to maintain scope.

**3. Testing Strategy**
- **Quality Engineer**: Set up Jest, 7 unit + 4 integration + 2 E2E, ≥85% coverage
- **Pragmatist**: Manual verification sufficient
- **Resolution:** Minimum 3 unit tests without full Jest setup. Use existing patterns if available.
- **Reasoning:** Critical priority + pagination complexity = need tests. But full infrastructure setup deferred.

### Adoption Tracking

| Specialist | Adopted | Rejected | Notes |
|------------|---------|----------|-------|
| Architect | 3 | 0 | Bidirectional cursor logic adopted. Test recommendation scaled to 3 tests. |
| Quality Engineer | 4 | 3 | Error handling, unit tests, input validation adopted. Deferred: Jest setup, integration/E2E tests, JSDoc, coverage reporting. |
| Pragmatist | 4 | 1 | Scope minimalism adopted (3 files). Rejected: skip tests entirely - Critical priority requires basic tests. |
| Frontend Specialist | 0 | 0 | Not applicable - React/Next.js project, not Angular/NDBX. |
| Resilience & Performance | 2 | 6 | Error handling adopted. Try-catch adopted. Deferred: exponential backoff, circuit breakers, timeouts, pool config, geocoding parallelization, monitoring. |
| Security Specialist | 1 | 0 | Input validation adopted. No new attack vectors identified. |
| GDPR Compliance | 0 | 0 | Approved as-is - no GDPR risks. No changes required. |
| API Contract & Migration | 0 | 0 | Approved as-is - non-breaking bug fix. No migration required. |

## Implementation Plan

**Files:** 1 new, 2 modified = **3 total files**

**Order:**
1. Modify `getConcertsPaginated()` to remove `skip:1` and handle bidirectional cursor logic
2. Modify `getConcertsPaginatedForUser()` with same fix
3. Add error handling to GET `/api/concerts` route
4. Add input validation for `limit` and `direction` parameters
5. Create minimal unit tests (3 scenarios) to verify cursor positioning
6. Manual test: visit `/?cursor=xyz`, verify concerts load and Load earlier button works

### Files

**1. MODIFY: src/lib/concerts.ts** (Service/Library)
- Fix cursor-based pagination logic in `getConcertsPaginated` and `getConcertsPaginatedForUser`
- Functions:
  - `getConcertsPaginated` (line 1185-1275): Remove skip:1, fetch bidirectionally, include cursor concert, adjust slice logic
  - `getConcertsPaginatedForUser` (line 1409-1523): Apply same fix
  - Add try-catch around Prisma queries, log errors with context
- Maps to: AC1
- Test file: `__tests__/lib/concerts.test.ts`

**2. MODIFY: app/api/concerts/route.ts** (API Route)
- Add error handling to GET handler
- Functions:
  - GET handler (line 17-109): Wrap `getConcertsPaginated()` in try-catch, validate input params
  - Validate `limit` (clamp to 1-100)
  - Validate `direction` (must be 'forward' or 'backward')
  - Return safe error message on failure
- Maps to: AC1
- Test file: `__tests__/api/concerts.test.ts`

**3. CREATE: __tests__/lib/concerts.test.ts** (Unit Tests)
- Minimal unit tests for cursor pagination
- Tests:
  - `test_getConcertsPaginated_no_cursor_returns_first_page`: Happy path
  - `test_getConcertsPaginated_with_cursor_forward_skips_cursor`: Existing behavior
  - `test_getConcertsPaginated_with_cursor_backward_includes_cursor`: AC1 fix verification
- Maps to: AC1, AC2

## Quality Gates

**Critical items addressed:**
- [C] No unhandled exceptions reach client as 500 with stack traces - FIXED by try-catch in route
- [C] All database queries use parameterised statements - ALREADY SAFE via Prisma
- [C] All external input validated - FIXED by limit/direction bounds checks

**High items addressed:**
- [H] All new/modified service functions have unit tests - ADDED 3 minimal tests
- [H] Keyset pagination correctly implemented bidirectionally - FIXED by cursor logic changes

**Unaddressed (deferred to follow-up):**
- [H] ≥80% line coverage - test infrastructure not set up
- [H] Integration tests - requires test DB setup
- [H] Retry logic with exponential backoff - Resilience SHOULD item
- [M] JSDoc on complex functions - can add later

## Risks

1. **MEDIUM**: Bidirectional cursor logic complexity - risk of duplicates or incorrect ordering if slice logic wrong
   - **Mitigation**: 3 unit tests verify positioning. Manual testing before merge.

2. **MEDIUM**: Minimal test coverage (3 tests) doesn't catch all edge cases
   - **Mitigation**: Defer comprehensive suite to follow-up. Document known edge cases in comments.

3. **LOW**: Deferred resilience items - pagination may fail on transient DB issues
   - **Mitigation**: Basic error handling prevents 500 leaks. Advanced resilience is SHOULD, not MUST.

## Devil's Advocate

**Verdict:** CHALLENGES_FOUND (10 challenges: 3 CRITICAL, 4 HIGH, 3 MEDIUM)

**Critical Challenges:**

1. **No test infrastructure exists** - Jest not installed, tests cannot run
   - **Fix**: Remove test file OR add Jest setup steps

2. **Slice logic not addressed** - Lines 1252-1256 remove concerts, plan doesn't specify changes
   - **Fix**: Specify exact slice logic when cursor exists

3. **Bidirectional fetch underspecified** - "Fetch both directions" has no implementation details
   - **Fix**: Specify single-query vs dual-query approach

**High Challenges:**

4. **Concert.id vs UserConcert.id mismatch** - URL cursor type confusion
   - **Fix**: Resolve cursor table reference mismatch

5. **No logging details** - Debugging will be impossible
   - **Fix**: Specify console.error format + Sentry integration

6. **Test scenario mismatch** - Tests check wrong code path
   - **Fix**: Add test for URL cursor + forward direction

**Medium Challenges:**

7-10. Cursor validation, deleted concert edge case, connection pool exhaustion risk, error handling pattern inconsistency

**DA Concessions:**
- Root cause identification correct
- Prisma queries are safe
- No GDPR risks
- Phased approach pragmatic
