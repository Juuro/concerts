# AMAC Planning Report: Venue Search User-Scoping + Predictive Text Highlighting

**Date:** 2026-03-29
**Stack:** TypeScript / Next.js 16
**Branch:** feat/band-autosuggest
**Confidence:** 94%

## Specialist Debate Summary

### Agreements (High Confidence)
- AC2: Early return guard `if (!userId) return []` — all 5 agents
- AC1: Add `AND uc."userId" = ${userId}` to both SQL queries — all 5 agents
- AC3: Remove `global_count` from SQL and scoring — all 5 agents
- AC4: `renderPredictiveText()` matching BandAutocomplete pattern — all 5 agents
- AC5: CSS `__match` (400) and `__prediction` (700) classes — all 5 agents
- 3 files modified, 0 new files — all 5 agents
- No breaking API changes — all 5 agents
- React JSX escaping prevents XSS — security + architect

### Conflicts Resolved
- **Tests**: QE proposed 9 test scenarios; Pragmatist noted no test infrastructure exists
  - **Resolution:** Pragmatist wins — no test framework in project
  - **Reasoning:** Adding tests requires separate initiative (Jest setup, mocks, etc.)

- **Redis rate limiting**: Resilience proposed migration; Pragmatist said out of scope
  - **Resolution:** Pragmatist wins — pre-existing, unrelated to feature
  - **Reasoning:** Rate limiting improvements should be a separate PR

- **JSDoc**: QE wanted full documentation; Pragmatist wanted minimal
  - **Resolution:** Split — update existing JSDoc on searchDatabaseVenues only
  - **Reasoning:** BandAutocomplete doesn't JSDoc its renderPredictiveText

- **HTTP 400 for invalid input**: Resilience vs existing pattern
  - **Resolution:** Existing pattern wins — out of scope

### Adoption Tracking
| Specialist | Adopted | Rejected | Notes |
|------------|---------|----------|-------|
| Architect | 4 | 0 | All architectural decisions adopted |
| Quality Engineer | 2 | 3 | Security reqs adopted; tests + full JSDoc rejected |
| Pragmatist | 5 | 0 | All simplification recommendations adopted |
| Resilience | 1 | 3 | userId filter perf gain adopted; Redis/retry/cache rejected |
| Security | 3 | 0 | All security fixes adopted |

## Implementation Plan

**Files:** 0 new, 3 modified
**Order:**
1. `src/lib/venues.ts` — Add userId guard and WHERE clause filter (AC1, AC2)
2. `src/lib/venues.ts` — Remove global_count, simplify scoring (AC3)
3. `src/components/VenueAutocomplete/VenueAutocomplete.tsx` — Add renderPredictiveText (AC4)
4. `src/components/VenueAutocomplete/venueAutocomplete.scss` — Add CSS classes (AC5)
5. Manual verification via dev server

### Files
- **MODIFY** `src/lib/venues.ts` — Scope DB search to user, simplify scoring
- **MODIFY** `src/components/VenueAutocomplete/VenueAutocomplete.tsx` — Add text highlighting
- **MODIFY** `src/components/VenueAutocomplete/venueAutocomplete.scss` — Add CSS classes

## Quality Gates
- Critical items addressed: Authorization, parameterised SQL, no secrets in logs, no N+1
- High items addressed: Input validation, error handling, consistent naming
- Unaddressed: Unit tests (no test infra), retry logic (pre-existing, out of scope)

## Risks
- LOW: Users with no concert history get empty DB results (by design, Ticketmaster/Photon fallback)
- LOW: Scoring changes affect result ordering (intentional, user-specific scoring more relevant)
- LOW: renderPredictiveText only highlights first occurrence (same as BandAutocomplete)

## Devil's Advocate
**Verdict:** CHALLENGES_FOUND (CRITICAL)

1. **[CRITICAL] DA1 — DbVenueRow sync**: Removing global_count from SQL without updating the TypeScript type and scoring formula produces NaN scores. Must coordinate three changes: SQL, type, formula.
2. **[HIGH] DA2 — Flex layout breaks text**: Multi-span output in a flex container adds gaps between text fragments. Need wrapper `<span>` with `display: inline-block`.
3. **[HIGH] DA3 — CSS class prefix**: Must use `venue-autocomplete__match`, not `band-autocomplete__match`. "Match the pattern" means structure, not strings.
4. **[MEDIUM] DA4 — Keep isUserVenue field**: Don't remove from return object despite all being true. Downstream guards and badges depend on it.

All DA challenges accepted and incorporated into implementation.
