-- Add trigram extension and index for fast ILIKE searches on Concert.venue
-- This improves venue autocomplete performance from O(n) full table scan to index lookup

-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index using trigram ops for fast substring matching
-- This supports ILIKE '%query%' patterns efficiently
CREATE INDEX IF NOT EXISTS "concert_venue_trgm_idx" ON "concert" USING GIN ("venue" gin_trgm_ops);
