-- Ensure trigram GIN index for concert venue names exists (concert.venue, not a concert_venue table).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "concert_venue_trgm_idx"
    ON "concert"
    USING GIN ("venue" gin_trgm_ops);
