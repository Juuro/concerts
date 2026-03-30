-- Ensure trigram GIN index for concert venues exists
CREATE INDEX IF NOT EXISTS "concert_venue_trgm_idx"
    ON "concert_venue"
    USING GIN ("name" gin_trgm_ops);
