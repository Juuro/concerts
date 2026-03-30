# AMAC Planning Report: Venue Search Fuzzy Matching

**Date:** 2026-03-28
**Stack:** TypeScript / Next.js 16
**Branch:** feat/band-autosuggest
**Confidence:** 92%

## Specialist Debate Summary

### Agreements (High Confidence)
- Delete rollback migration 20260326141451 (7/7)
- Add word_similarity() > 0.3 to WHERE clause (7/7)
- Add try/catch with Sentry to searchDatabaseVenues() (7/7)
- Keep $queryRaw tagged template literals for injection safety (7/7)
- No breaking changes to /api/venues/search (7/7)
- ILIKE matches rank higher than similarity-only matches (6/7)

### Conflicts Resolved
- **AC5 timing**: Resilience proposed ship now, Pragmatist proposed defer
  - **Resolution:** Ship now — queue serializes all concurrent requests
  - **Reasoning:** Rate limiting + dedup is sufficient without queue

- **Testing**: QE proposed Jest with 80% coverage, Pragmatist proposed manual
  - **Resolution:** Manual testing — no test framework in project
  - **Reasoning:** Adding Jest is out of scope for this performance fix

- **Retry logic**: Resilience proposed exponential backoff, Pragmatist proposed skip
  - **Resolution:** No retry — withTimeout() already wraps DB calls
  - **Reasoning:** Search is non-critical; returning [] is acceptable

- **Rate limit cleanup**: Resilience proposed cleanup, Pragmatist proposed skip
  - **Resolution:** Out of scope
  - **Reasoning:** Vercel cold starts handle cleanup

- **Threshold config**: Architect proposed configurable, Pragmatist proposed hardcode
  - **Resolution:** Hardcode 0.3
  - **Reasoning:** Plan explicitly forbids extra configurability

### Adoption Tracking
| Specialist | Adopted | Rejected | Notes |
|------------|---------|----------|-------|
| Architect | 4 | 1 | Configurable threshold rejected |
| Quality Engineer | 3 | 2 | Jest tests rejected (no framework) |
| Pragmatist | 5 | 1 | Deferring AC5 rejected |
| Resilience | 4 | 2 | Retry logic, rate limit cleanup rejected |
| Security | 3 | 1 | Redis rate limiting out of scope |
| GDPR | 2 | 0 | No PII concerns |
| API Contract | 3 | 0 | All findings adopted |

## Implementation Plan

**Files:** 0 new, 2 modified, 1 deleted
**Order:**
1. Delete rollback migration directory (AC2)
2. Add new forward migration to ensure index exists (DA1 fix)
3. Modify searchDatabaseVenues() — fuzzy matching + error handling (AC1, AC3, AC4)
4. Modify searchVenues() in photon.ts — remove queue, fix rate limit race (AC5, DA2 fix)
5. Verify API contract unchanged (AC6)

### Files
- **DELETE** `prisma/migrations/20260326141451_add_venue_trigram_index/` — rollback migration
- **MODIFY** `src/lib/venues.ts` — word_similarity() + try/catch + Sentry
- **MODIFY** `src/utils/photon.ts` — remove queue, fix rate limit atomicity

## Quality Gates
- Critical items addressed: SQL injection safety, no unhandled exceptions, no secrets logged, migrations backward-compatible
- High items addressed: Error context logging, no internal details leaked, DB indexes, timeouts configured
- Unaddressed: Unit tests (no framework), structured JSON logging (uses Sentry)

## Risks
- **HIGH**: pg_trgm index may be missing if rollback was applied → new forward migration
- **MEDIUM**: word_similarity threshold 0.3 not validated against corpus → adjust post-deploy
- **LOW**: Photon rate under concurrency → rate limiting + dedup sufficient

## Devil's Advocate
**Verdict:** CHALLENGES_FOUND (3 HIGH, 2 MEDIUM, 1 LOW)

- **[HIGH] DA1**: Deleting rollback migration doesn't restore index → Add new forward migration
- **[HIGH] DA2**: Race condition in Photon rate limiter → Set photonLastRequestAt before await
- **[HIGH] DA3**: INNER JOIN excludes zero-attendee venues → Pre-existing constraint, acknowledged
- **[MEDIUM] DA4**: ticketmaster.ts logs query in Sentry → Explicitly exclude query
- **[MEDIUM] DA5**: Score propagation gap → Include similarity in SQL SELECT
- **[LOW] DA6**: Include actual SQL template → Will be in implementation
