# AMAC Planning Report: Venue Search Quality (Missing Photon Tags + IP Geolocation)

**Date:** 2026-03-29
**Stack:** TypeScript / Next.js
**Branch:** feat/band-autosuggest
**Confidence:** 93%

## Specialist Debate Summary

### Agreements (High Confidence)
- AC1: Add `amenity:events_centre` and `amenity:music_venue` to DEFAULT_VENUE_TAGS — all 8 agents
- AC2: Change Photon from fallback-only to parallel tagged+untagged with merge — 6/8 agents
- AC3: Extract Vercel geo headers as fallback location bias — 7/8 agents
- AC5: Geo headers must be transient-only, never logged/stored — security + GDPR
- 2 files modified, 0 new files — architect + pragmatist + resilience
- No breaking API changes — API contract + architect
- No cookie banner changes — GDPR

### Conflicts Resolved
- **Rate limit cleanup**: Resilience (MUST) vs Pragmatist (out of scope)
  - **Resolution:** Pragmatist wins — pre-existing, separate concern
  - **Reasoning:** Rate limit cleanup is not related to venue search quality

- **Client-side fetch timeout**: Resilience (SHOULD) vs Pragmatist (out of scope)
  - **Resolution:** Pragmatist wins — pre-existing UX issue
  - **Reasoning:** Client timeout should be separate PR

- **Defense-in-depth assertion**: Security (CRITICAL) vs Pragmatist (primary guard sufficient)
  - **Resolution:** Skip — searchDatabaseVenues already returns [] for no userId
  - **Reasoning:** Double-guarding adds noise without value

- **Unit tests**: QE (recommended) vs Pragmatist (no test infra)
  - **Resolution:** Pragmatist wins — no test framework in project
  - **Reasoning:** Adding Jest + tests would triple scope

- **Privacy policy update**: GDPR (SHOULD) vs Pragmatist (follow-up story)
  - **Resolution:** Split — add brief note (1-2 lines, trivial)
  - **Reasoning:** GDPR transparency warrants brief mention

- **getUserVisitedLocations pagination**: Resilience (SHOULD) vs Pragmatist (out of scope)
  - **Resolution:** Pragmatist wins — performance edge case, separate PR

### Adoption Tracking
| Specialist | Adopted | Rejected | Notes |
|------------|---------|----------|-------|
| Architect | 4 | 0 | All architecture decisions adopted |
| Quality Engineer | 2 | 2 | Checklist items adopted; tests + JSDoc rejected |
| Pragmatist | 5 | 0 | All scope decisions adopted |
| Frontend | 0 | 0 | N/A — backend-only changes |
| Resilience | 2 | 3 | Core fixes adopted; cleanup + timeout + pagination rejected |
| Security | 2 | 1 | Transient-only + Sentry adopted; assertion rejected |
| GDPR | 3 | 0 | Transient-only, no cookie banner, privacy note adopted |
| API Contract | 1 | 0 | No breaking changes confirmed |

## Implementation Plan

**Files:** 0 new, 2 modified (+1 minor: privacy page)
**Order:**
1. `src/utils/photon.ts` — Add missing OSM tags to DEFAULT_VENUE_TAGS
2. `src/utils/photon.ts` — Rewrite searchVenues for parallel tagged+untagged with merge
3. `app/api/venues/search/route.ts` — Extract Vercel geo headers as fallback lat/lon
4. `app/privacy/page.tsx` — Add brief geo biasing note (DA4)
5. Manual verification via dev server + Playwright

### Files
- **MODIFY** `src/utils/photon.ts` — Add `amenity:events_centre` + `amenity:music_venue`; parallel search strategy
- **MODIFY** `app/api/venues/search/route.ts` — Extract Vercel geo headers, validate with parseFloat + range checks
- **MODIFY** `app/privacy/page.tsx` — One-line geo biasing disclosure (DA4)

## Quality Gates
- Critical items addressed: Parameterised queries, input validation, userId guard
- High items addressed: No IP/geo in Sentry, geo headers transient-only, OSM tags coverage
- Unaddressed: Unit tests (no infra), rate limit cleanup (pre-existing), Redis (scaling)

## Risks
- LOW: Parallel Photon searches double API calls (~1.4s total; acceptable for 300ms debounce)
- LOW: Vercel geo headers not available in dev (graceful fallback)
- LOW: New OSM tags may surface slightly less relevant venues (tags are precise; easy to refine)

## Devil's Advocate
**Verdict:** CHALLENGES_FOUND (HIGH)

1. **[HIGH] DA1 — Tagged scoring impossible**: PhotonSearchResult has no score field; venues.ts assigns score:10 uniformly. Fix: use insertion order (tagged first) for dedup preference, not scoring. Update plan description.
2. **[HIGH] DA2 — Rate limiter contention**: Parallel doubles API calls against process-global rate limiter. Single user ~1.4s, two concurrent ~2.1s+. Fix: accept low-concurrency reality; or test if AC1 alone suffices.
3. **[HIGH] DA3 — Missing validation spec**: Vercel geo headers need parseFloat + isNaN + range checks. Fix: replicate pattern from existing lines 70-87.
4. **[MEDIUM] DA4 — Privacy page missing**: Agreed in conflict resolution but absent from file list. Fix: add to implementation plan.
5. **[MEDIUM] DA5 — Sentry may capture headers**: Code comment insufficient; verify Sentry config. Fix: check beforeSend/denyUrls.
6. **[LOW] DA6 — AC1 may suffice**: Adding events_centre tag alone may fix the bug. Parallel strategy adds complexity. Fix: test AC1 first.

All DA challenges accepted and incorporated into implementation.
