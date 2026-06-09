# Plan: Improve Venue Search Quality with Fuzzy Matching

## Context

**Problem**: Users searching for "hanns-martin-schleyer-ha" cannot find "Hanns-Martin-Schleyer-Halle" until the full name is typed. The venue search requires exact substring matching.

**Root Cause**: The database search uses `ILIKE '%query%'` which requires exact character sequences. Additionally, the trigram index was created in migration `20260326000000` but **dropped** in migration `20260326141451`, causing O(n) full table scans.

**Existing Assets**:
- `pg_trgm` extension migration exists (but index was dropped)
- Levenshtein distance already implemented in `app/api/admin/bands/duplicates/route.ts`
- Multi-source architecture (Database + Ticketmaster + Photon) is sound

## AMAC Specialist Consensus

7 specialists analyzed this task. Key consensus points:

| Specialist | Recommendation |
|------------|----------------|
| **Architect** | Use PostgreSQL `word_similarity()` + `similarity()` instead of ILIKE |
| **Pragmatist** | Don't add more APIs - fix what exists first (80/20 rule) |
| **Resilience** | Restore trigram index immediately (50-100x speedup) |
| **QE** | Test threshold: similarity > 0.3 for partial matches |
| **Security** | Add query complexity limits for DoS protection |
| **API Contract** | No breaking changes; resolve duplicate migrations |
| **GDPR** | Approved; verify Ticketmaster DPA for EU compliance |

## Recommended Approach

### Phase 1: Quick Wins (30 minutes)

1. **Resolve duplicate migrations**
   - Delete `prisma/migrations/20260326141451_add_venue_trigram_index/` (the rollback)
   - Keep `prisma/migrations/20260326000000_add_venue_trigram_index/` (creates the index)

2. **Verify trigram index exists in production**
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'concert' AND indexname LIKE '%trgm%';
   ```

### Phase 2: Enable Fuzzy Database Search (2-3 hours)

**File**: [src/lib/venues.ts](src/lib/venues.ts)

**Current query** (line 93):
```sql
WHERE c.venue ILIKE ${"%" + query + "%"}
```

**New query** using trigram similarity:
```sql
WHERE
  c.venue ILIKE ${"%" + query + "%"}
  OR word_similarity(${query}, c.venue) > 0.3
ORDER BY
  CASE
    WHEN c.venue ILIKE ${"%" + query + "%"} THEN 1.0
    ELSE word_similarity(${query}, c.venue)
  END DESC,
  (user_count * 100 + global_count) DESC
```

**Why `word_similarity()` over `similarity()`**:
- `word_similarity()` matches partial words in compound names (Hanns-Martin-Schleyer-Halle)
- Threshold 0.3 catches "schleyer-ha" matching "Schleyer-Halle" (~0.67 score)

### Phase 3: Add Query Tokenization (Optional, 1-2 hours)

For even better matching, split compound queries:
- "hanns-martin-schleyer" → search for ["hanns", "martin", "schleyer"]
- Merge and rank by token match count

**Location**: `searchVenuesEnhanced()` in [src/lib/venues.ts](src/lib/venues.ts)

### Phase 4: Performance & Resilience (1 hour)

1. **Replace Photon queue serialization** ([src/utils/photon.ts:17-36](src/utils/photon.ts#L17-L36))
   - Current: 700ms minimum interval blocks concurrent requests
   - Fix: Use request deduplication Map instead of queue serialization

2. **Add error handling** to `searchDatabaseVenues()` ([src/lib/venues.ts:74-97](src/lib/venues.ts#L74-L97))
   - Wrap in try/catch, return `[]` on error
   - Log to Sentry without exposing query details

## Files to Modify

| File | Change |
|------|--------|
| [src/lib/venues.ts](src/lib/venues.ts) | Update SQL query to use `word_similarity()`, add error handling |
| [src/utils/photon.ts](src/utils/photon.ts) | Replace queue with request deduplication |
| `prisma/migrations/20260326141451_*/` | **Delete** (this drops the needed index) |

## Files NOT to Modify

- `app/api/venues/search/route.ts` - API contract unchanged
- `src/components/VenueAutocomplete/` - UI unchanged
- `src/utils/ticketmaster.ts` - Already working correctly
- `src/types/photon.ts` - Types unchanged

## What NOT to Do

Per AMAC specialist consensus:
- **Don't add more APIs** (Songkick, Setlist.fm, Google Places) - adds complexity without evidence they'll help
- **Don't implement full-text search** (`tsvector`) - overkill for venue names
- **Don't create a dedicated Venue table** - premature schema change
- **Don't implement client-side fuzzy search** - server-side is sufficient

## Test Cases

After implementation, these should pass:

| Query | Expected Match | Similarity |
|-------|----------------|------------|
| "hanns-martin-schleyer-ha" | "Hanns-Martin-Schleyer-Halle" | ~0.67 |
| "schleyer" | "Hanns-Martin-Schleyer-Halle" | ~0.45 |
| "o2 arena" | "O2 World Berlin" | ~0.50 |
| "madison sq" | "Madison Square Garden" | ~0.55 |
| "Schleier-Halle" (typo) | "Schleyer-Halle" | ~0.87 |

## Verification

1. **Manual test**: Search for "hanns-martin-schleyer-ha" in the venue autocomplete
2. **Query performance**: Run `EXPLAIN ANALYZE` on the new query - should use GIN index
3. **Screenshot test**: `node screenshot.mjs http://localhost:3000/concerts/new venue-search`

## Estimated Effort

| Phase | Time | Priority |
|-------|------|----------|
| Phase 1: Migration cleanup | 30 min | MUST |
| Phase 2: Fuzzy search | 2-3 hours | MUST |
| Phase 3: Tokenization | 1-2 hours | NICE-TO-HAVE |
| Phase 4: Resilience | 1 hour | SHOULD |

**Total**: 4-6 hours for core fix (Phases 1-2)

## Security & GDPR Notes

- SQL queries use Prisma's `$queryRaw` with tagged template literals (safe from injection)
- Per-user rate limiting recommended for production
- Ticketmaster DPA should be verified by legal for EU compliance (non-blocking for dev)
