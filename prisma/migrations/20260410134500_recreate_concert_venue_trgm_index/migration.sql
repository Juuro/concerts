-- Recreate venue trigram index after historical drop migration.
-- Safe to apply repeatedly due to IF NOT EXISTS guards.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "concert_venue_trgm_idx"
    ON "concert"
    USING GIN ("venue" gin_trgm_ops);
