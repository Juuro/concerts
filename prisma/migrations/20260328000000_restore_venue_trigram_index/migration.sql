-- Restore venue trigram index that may have been dropped by a prior rollback migration.
-- The pg_trgm extension and GIN index are required for word_similarity() fuzzy matching.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "concert_venue_trgm_idx" ON "concert" USING GIN ("venue" gin_trgm_ops);
