# Monetisation Analysis – concerts app

> **Context**: This is a personal concert attendance tracker built with Next.js 15 + Contentful CMS. It is currently a read-only, statically generated portfolio site. The analysis below assumes the owner wants to evolve it into a multi-user SaaS product.

---

## Table 1 – Existing Features Ranked by Monetisability

| # | Feature | Description | Monetisability Rank | Reasoning |
|---|---------|-------------|---------------------|-----------|
| 1 | **Interactive Map** (Leaflet + Mapbox + Cluster) | Zoomable world map with all concert locations, clustered markers and popup info | ⭐⭐⭐⭐⭐ | Visually compelling, hard to replicate manually. The "show me everywhere I've been" view is a premium hook — users would pay for a beautifully designed, shareable map view. Mapbox styling upgrades (custom colours, satellite, dark mode) sit naturally behind a paywall. |
| 2 | **Statistics Dashboard** (bar charts: top years / bands / cities) | Data visualisation of attendance patterns over time | ⭐⭐⭐⭐⭐ | Data-obsessed music fans love personal stats. Spotify Wrapped proved this drives massive engagement. Deeper analytics (longest streak, distance travelled, decade breakdown) are natural upsell candidates. |
| 3 | **Band Detail Pages** (concert history + Last.fm genres + link) | Per-artist page aggregating every gig, genre tags and external metadata | ⭐⭐⭐⭐ | Band pages serve as a content hub. They become more valuable with more data: ticket prices, photos, setlists, YouTube clips. Users who can annotate their own memories (free tier = view, paid tier = edit & enrich) create a strong upgrade incentive. |
| 4 | **Last.fm Integration** (artist genres, external links) | Enriches band data with genre tags and Last.fm profile links at build time | ⭐⭐⭐⭐ | Metadata enrichment reduces manual data entry friction. Expanding this to Spotify, Bandcamp or MusicBrainz is a paid differentiator — richer data means richer insights. |
| 5 | **Festival Support** (multi-band events, badge display) | Distinguishes festivals from regular gigs; shows all bands as clickable badges | ⭐⭐⭐⭐ | Festivals are high-value events with many bands. A "My Festival History" view, linecard poster export, or "bands I discovered at festivals" analysis is a clear upsell. |
| 6 | **City Pages** (geocoded + concerts per location) | Per-city pages listing all concerts at that location | ⭐⭐⭐ | Powers a "cities visited for music" narrative. Combine with travel stats (km travelled, countries) and it becomes a premium travel-music crossover feature. |
| 7 | **Year Pages** (per-year concert listings) | Filtered view of concerts in a given calendar year | ⭐⭐⭐ | Foundation for year-in-review / "wrapped" features. Alone it is basic; combined with comparative stats (vs previous year, vs average user) it becomes a premium engagement driver. |
| 8 | **Concert Cards** (image, date, venue, city, bands) | Card UI showing all key metadata per concert | ⭐⭐⭐ | The core display unit. Monetisable through premium card templates, photo upload slots, or memory annotations. |
| 9 | **Future Concert Highlighting** | Visual badge distinguishing upcoming gigs from past ones | ⭐⭐⭐ | Gateway feature for a ticketing/wish-list integration. Users who track future gigs are more likely to pay for notifications and calendar sync. |
| 10 | **Reverse Geocoding** (Photon/Komoot) | Converts raw coordinates to human-readable city names | ⭐⭐ | Important for data quality but invisible to users. Monetisable indirectly — accurate location data enables travel analytics. |
| 11 | **Concert Count** (header + per-band/city/year) | Displays total concert count globally and per-filter | ⭐⭐ | Vanity metric that drives user motivation to log more. Supports gamification (badges, milestones) but is not itself a paywall feature. |
| 12 | **Navigation** (Home + Map) | Minimal header navigation | ⭐ | Infrastructure. Not directly monetisable. |
| 13 | **Static Site Generation** (Next.js force-static) | All pages pre-rendered at build time | ⭐ | Performance feature. Users don't pay for fast pages, but poor performance kills conversion. |
| 14 | **SEO Metadata** (per-page title/description) | Open Graph and HTML title tags per page | ⭐ | Organic discovery vehicle. Drives top-of-funnel traffic to the free tier, supporting an upgrade-to-premium funnel. |
| 15 | **Contentful CMS Backend** | Headless CMS for structured concert data management | ⭐ | Backend infrastructure. Swapping to a database (Postgres/Prisma) unlocks multi-user — a prerequisite for SaaS monetisation. |

---

## Table 2 – Non-Existent Features Ranked by Willingness to Pay (Premium Drive)

| # | Feature | Description | Pay-to-Unlock Drive | Reasoning |
|---|---------|-------------|---------------------|-----------|
| 1 | **Year-in-Review / "Gig Wrapped"** | Annual personalised summary: top artist, most-visited city, total distance, biggest festival, rarest show — shareable as a visual card | 🔥🔥🔥🔥🔥 | Spotify Wrapped is the most viral feature in music. Music fans will actively upgrade to unlock a shareable summary. High social proof value drives organic acquisition. |
| 2 | **Public Profile & Social Sharing** | Shareable public URL for your concert collection (e.g. `concerts.app/u/juuro`); friends can follow, compare, and react | 🔥🔥🔥🔥🔥 | Network effects make the app more valuable for every user added. A viral loop: user shares profile → friend signs up. Public vs private toggle is a classic free/paid lever. |
| 3 | **Ticket Spending Tracker** | Log ticket prices, travel costs, merchandise; see total spend per artist/year/city with budget analytics | 🔥🔥🔥🔥🔥 | "I've spent €4,200 on concerts this year" is a simultaneously alarming and delightful insight. The financial data layer transforms a log into a personal finance sub-tool — strong premium retention. |
| 4 | **Concert Wishlist & Upcoming Show Alerts** | Save upcoming tours to a watchlist; receive push/email notifications when a watched artist announces dates near you | 🔥🔥🔥🔥🔥 | Ticketmaster and Songkick charge for this (or monetise via affiliate). Users who want to see every Radiohead show will pay to never miss an announcement. Direct affiliate revenue from ticket sales is also possible. |
| 5 | **Setlist Integration** (setlist.fm API) | Automatically fetch the setlist for every logged concert; highlight songs you've heard live vs studio catalogue | 🔥🔥🔥🔥 | Setlist data transforms a date/venue log into a rich musical memory. "You've heard Bohemian Rhapsody live 3 times" is deeply personal. Heavy users of setlist.fm would consolidate into one app. |
| 6 | **Map Poster Export / Print Shop** | Generate a high-resolution printable poster of your concert map or timeline; order physical prints | 🔥🔥🔥🔥 | Direct one-time revenue per purchase. Physical products with emotional value (your personal concert history) command premium prices (€20–€60). No subscription required — single-purchase upsell. |
| 7 | **Spotify Playlist Generator** | Auto-create Spotify playlists from concerts (e.g. "Every band I saw in 2024") | 🔥🔥🔥🔥 | Deep Spotify integration is a highly requested feature in music apps. Lowers the barrier between listening and attending — creates daily app usage (checking playlists → logging new gigs). |
| 8 | **Friend Comparison / Social Layer** | Compare your stats with friends: who has seen more shows, most overlapping bands, "you need to see them live" recommendations based on friend data | 🔥🔥🔥🔥 | Social competition is a proven retention and upgrade driver (Duolingo leagues, Strava segments). Even non-paying users sign up to compare, creating a conversion funnel. |
| 9 | **Concert Recommendations Engine** | Suggest upcoming shows based on attendance history, genre preferences, location and friend activity | 🔥🔥🔥 | Personalised recommendations reduce the cognitive load of finding new gigs. Recommendation accuracy improves with more user data — a virtuous cycle that increases LTV. Affiliate integration with ticket platforms monetises each click. |
| 10 | **Photo & Memory Vault** | Attach photos, voice notes, or text memories to each concert; private journal vs public gallery options | 🔥🔥🔥 | Personal concerts are emotional anchors. A photo of the crowd or the setlist scribbled on a napkin has high sentimental value. Storage is a natural premium tier (free = 5 photos/gig, paid = unlimited). |
| 11 | **Multi-User / Family / Group Accounts** | Shared concert log for couples or friend groups; see who attended which shows together | 🔥🔥🔥 | Couples who go to concerts together are a natural two-seat subscription. "We saw 47 shows together" is a relationship milestone metric. |
| 12 | **CSV / PDF Export & Data Portability** | Export full concert history as spreadsheet or printable PDF | 🔥🔥🔥 | Power users and data hoarders will pay for portability. Offering import (e.g. from Last.fm scrobbles or spreadsheets) lowers switching cost and accelerates growth. |
| 13 | **Venue & Artist Wikipedia/Wikidata enrichment** | Show venue history, capacity, city context; show artist biography summary inline | 🔥🔥 | Adds encyclopaedic depth without user effort. Free tier can show 1–2 facts; paid tier unlocks full context panel. |
| 14 | **Mobile App (PWA or Native)** | Offline-capable mobile experience; quick-add concert from your phone right after the show | 🔥🔥 | The most common friction point for concert loggers is remembering to add the gig later. A one-tap "I'm at a show" capture removes this barrier entirely and dramatically increases data completeness. |
| 15 | **White-Label / Embed Widget** | Embed your concert map or stats widget on a personal website or blog | 🔥🔥 | Targets bloggers, journalists, and artists who want to display their live history publicly. A `<iframe>` embed with a "Powered by concerts.app" watermark removed on paid plan is a classic SaaS upsell pattern. |

---

## Summary Monetisation Strategy

| Tier | Price | Key Features |
|------|-------|--------------|
| **Free** | €0 | Personal log (up to 50 concerts), basic stats, public profile, map view |
| **Fan** | €4/month | Unlimited concerts, full statistics, setlist sync, photo vault (50 photos), CSV export |
| **Superfan** | €9/month | All Fan features + Gig Wrapped annual report, Spotify playlist generator, ticket spending tracker, concert alerts |
| **Print** | €25–€50 one-time | High-res personalised concert map poster (physical or digital) |

**Primary revenue drivers**: Subscriptions (Fan/Superfan tiers) + Print shop one-time purchases + Ticket affiliate commissions (CPA on referred ticket sales).

**Fastest path to first revenue**: Add a Spotify playlist generator and a "Year in Review / Gig Wrapped" feature gated behind a simple email signup — use these as top-of-funnel to build an audience before charging.
