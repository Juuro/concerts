# AI Feature Ideas

## Concert Discovery & Recommendations

- **Personalized concert recommendations** — Analyze a user's concert history (bands, genres, cities, frequency) to suggest upcoming shows they'd likely enjoy. Could integrate with event APIs like Songkick or Bandsintown.
- **"Fans like you" suggestions** — For users with public profiles, find users with similar taste and surface bands/venues they've attended that the current user hasn't.

## Data Enrichment & Automation

- **Setlist.fm integration** — Automatically fetch setlists for concerts via the setlist.fm API. Expandable section on concert cards shows songs played per band, with encore markers, cover attributions, and tape badges. Searches by artist name + concert date (`dd-MM-yyyy`). Data persisted in a `SetlistSong` table linked to `ConcertBand`. Follows the Last.fm enrichment pattern: feature flag (`ENABLE_SETLISTFM`), rate limiting, circuit breaker, retry logic. API route at `GET /api/concerts/[id]/setlist` fetches on first expand, serves from DB after. New component: `SetlistDisplay`. Requires a free setlist.fm API key (`SETLISTFM_API_KEY`). See `.claude/plans/snuggly-wondering-frog.md` for full implementation plan.
- **Smart band tagging** — When adding a concert, auto-suggest related genres, sub-genres, or mood tags based on the band's Last.fm data and bio. Goes beyond what Last.fm provides natively.
- **Concert memory generation** — Given a date, venue, and bands, generate a short "memory" summary pulling in context like setlist data (setlist.fm), weather that day, or notable events from that tour.
- **Auto-fill from ticket photos** — OCR a ticket photo or screenshot to extract date, venue, and band names, pre-filling the concert form.

## Statistics & Insights

- **Year-in-review narrative** — Generate a personalized annual summary: "You saw 23 shows across 8 cities. Your genre range expanded into post-punk. Your most adventurous month was July..."
- **Spending pattern analysis** — Beyond raw totals, identify trends: "You spend 40% more on festival tickets than standalone shows" or "Your average cost per show has increased 15% year-over-year."
- **Taste evolution timeline** — Visualize how a user's genre preferences have shifted over time using their concert history.

## Search & Interaction

- **Natural language concert search** — "What was that outdoor show I went to in Berlin in summer 2022?" instead of filtering through dropdowns.
- **Smart venue deduplication** — Use fuzzy matching / embeddings to detect when users have entered the same venue under different names (e.g., "O2 Academy Brixton" vs "Brixton Academy") and suggest merges.

## Content & Social

- **Bio generation for bands** — For bands without a Last.fm bio, generate a concise description from available data (genres, associated acts, concert frequency in the app).
- **Public profile summaries** — Auto-generate a short "music identity" blurb for public profiles based on concert history.

## Recommended Starting Points

1. **Ticket photo OCR** — High user value, clear scope. Use a vision model to extract structured data from ticket images and pre-fill the concert form.
2. **Natural language search** — Moderate complexity. An LLM translates a natural query into the existing `ConcertFilters` interface parameters.
3. **Year-in-review narrative** — Structured stats data already exists via `getConcertStatistics()` and spending aggregation. Pass it to an LLM for narrative generation.

These three avoid the need for external event APIs or embedding infrastructure, working primarily with data already available in the app.
