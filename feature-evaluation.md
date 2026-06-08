# End-user Feature Evaluation

| Feature                                      | Core Delight                    | Cost to You              | Upgrade Trigger           | Competitor Benchmark          | **Suggested Tier**                |
| -------------------------------------------- | ------------------------------- | ------------------------ | ------------------------- | ----------------------------- | --------------------------------- |
| **Log concerts** (date, venue, lineup)       | ✅ Essential – core value       | Low – CRUD               | No FOMO                   | Matches Bandsintown           | **Free**                          |
| **Multiple bands + headliner**               | ✅ Essential – real lineups     | Low                      | No FOMO                   | Basic                         | **Free**                          |
| **Link to festivals**                        | ✅ Essential for festival-goers | Low                      | No FOMO                   | Basic                         | **Free**                          |
| **Track spending cost**                      | Nice to have                    | Low                      | Mild (profile flex)       | Not common                    | **Free**                          |
| **Personal notes**                           | ✅ Delight (free 100 chars)     | Low                      | Tease premium unlimited + rich text | Beats Bandsintown | **Free** (100 chars); Premium: unlimited + rich text |
| **Venue autocomplete** (Photon)              | ✅ Essential for input          | **Moderate** – API calls | No FOMO                   | Basic                         | **Free\***                        |
| **Band search**                              | ✅ Essential                    | Low – own DB             | No FOMO                   | Basic                         | **Free**                          |
| **Festival search**                          | Essential                       | Low                      | No FOMO                   | Basic                         | **Free**                          |
| **Band/festival validation**                 | Power user – cleaner data       | Low–moderate             | No FOMO                   | Beats competitors             | **Premium**                       |
| **Stats** (counts, top bands/cities/years)   | ✅ Core "wow"                   | Low – cached agg         | No FOMO                   | Basic                         | **Free**                          |
| **Spending aggregation**                     | Nice to have                    | Low                      | No FOMO                   | Uncommon                      | **Free**                          |
| **Personal map view**                        | ✅ Strong delight               | Moderate – tiles/GeoJSON | No FOMO                   | Beats Bandsintown             | **Free**                          |
| **Public profile**                           | Sharing/secondary               | Low                      | ✅ **Creates envy**       | Beats with shareable profiles | **Premium**                       |
| **Map on public profile**                    | Enhances sharing                | Same as map              | ✅ **Envy** – visual flex | Strong differentiator         | **Premium**                       |
| **Browse by band/city/year**                 | Essential filtering             | Low                      | No FOMO                   | Basic                         | **Free**                          |
| **Infinite scroll / Load earlier**           | UX                              | Low                      | No FOMO                   | Basic                         | **Free**                          |
| **Privacy controls** (hide location/cost)    | Privacy                         | Low                      | Part of sharing           | Not common                    | **Premium** (with public profile) |
| **Currency preference**                      | Essential for cost              | Low                      | No FOMO                   | Basic                         | **Free**                          |
| **Accessibility** (keyboard, reduced motion) | Right thing to do               | Low                      | No FOMO                   | Often baseline                | **Free**                          |

---

## Summary

**Free tier (core delight, low cost, no envy):**  
Logging concerts, venue/band/festival search, lineup + festival linking, basic statistics (counts, charts), spending tracking, personal map view, browsing by band/city/year, currency preference, accessibility features, personal notes (100 chars/entry).

**Premium tier (power user / envy / differentiators):**

- Public profile
- Map on public profile
- Personal notes: unlimited + rich text (tease upgrade from free 100 chars)
- Band/festival validation & correction
- Privacy controls (when paired with public profile)

---

## Caveats

- **Venue autocomplete (Photon):** Cost can grow with scale. Consider rate-limiting free users (e.g., X venue lookups per month) and unlimited for premium.
- **Public profile:** The strongest upgrade trigger — "share your journey with friends" creates natural envy (getmonetizely).
- **Personal notes:** Free 100 chars/entry for delight; premium teases unlimited + rich text. Clear differentiator vs. Bandsintown (mobindustry).
