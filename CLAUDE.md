# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 multi-tenant web application for tracking personal concert attendance. Features user authentication via Better Auth, PostgreSQL database via Prisma, MapLibre GL for interactive maps, and Last.fm API integration for band metadata enrichment.

## Accessibility, Security & Privacy

These principles must always be respected when building or editing features:

- **Accessibility**: Use semantic HTML elements. Apply `aria-label`/`aria-labelledby` on interactive elements, `aria-hidden="true"` on decorative icons. Support keyboard navigation (Arrow keys, Enter, Escape) for dropdowns and dialogs. Use native HTML5 `<dialog>` for modals. Ensure visible focus states.
- **Security**: All mutating API routes must verify the session via `auth.api.getSession()`. Concert update/delete must verify `userId` ownership. Validate inputs (username format, currency whitelist, required fields). Prisma parameterized queries prevent SQL injection. Never expose sensitive data in client responses.
- **Privacy**: Public profiles are strictly opt-in via the `isPublic` flag. Concert data is scoped to the owning user. Public profile routes return 404 for non-public users. The concerts API checks `isPublic` before returning data for username-based queries.

## Commands

```bash
yarn dev              # Start development server (localhost:3000)
yarn build            # Production build (prisma generate + next build)
yarn lint             # ESLint with next/core-web-vitals
yarn format           # Prettier formatting
yarn release          # Semantic versioning with standard-version

# Database commands
yarn db:generate      # Generate Prisma client
yarn db:migrate       # Run database migrations
yarn db:push          # Push schema to database (no migration)
yarn db:studio        # Open Prisma Studio

# Migration scripts (one-time)
yarn migrate:contentful  # Import data from Contentful to PostgreSQL
yarn migrate:venues      # Backfill venue/normalizedCity data
```

## Architecture

### Data Flow

1. **Authentication**: Better Auth handles OAuth (GitHub) and session management
2. **Database**: Prisma ORM with PostgreSQL (Vercel Postgres in production)
3. **Runtime**: Server components fetch from PostgreSQL via Prisma
4. **Dynamic rendering**: Protected routes use `force-dynamic`

### Key Directories

- `app/` - Next.js 15 App Router pages
  - `(auth)/` - Authentication pages (login)
  - `(protected)/` - Protected routes requiring auth (dashboard, settings, concert CRUD)
  - `u/[username]/` - Public user profiles (ISR, 1-hour revalidation)
  - `band/[slug]/` - Public band pages with inline edit toggle
  - `city/[slug]/` - City-specific concert listing pages
  - `year/[year]/` - Year-specific concert listing pages
  - `map/` - Global concert map view
  - `api/` - API routes for CRUD operations
- `src/components/` - React components with `.scss` co-located styles
- `src/lib/` - Core libraries
  - `prisma.ts` - Prisma client singleton
  - `auth.ts` - Better Auth server configuration
  - `auth-client.ts` - Better Auth client
  - `concerts.ts` - Concert CRUD, pagination, statistics, spending aggregation
  - `bands.ts` - Band CRUD and search operations
  - `festivals.ts` - Festival CRUD, search, and get-or-create operations
- `src/utils/` - Utility functions
  - `photon.ts` - Photon API venue search (OpenStreetMap)
  - `lastfm.ts` - Last.fm API client
  - `data.ts` - Reverse geocoding via Photon
  - `helpers.ts` - Data transformation utilities (cityToSlug, extractCityName)
  - `featureFlags.ts` - Environment-based feature flag evaluation
- `src/types/` - TypeScript type definitions
- `prisma/` - Prisma schema and migrations

### Database Schema

- **User**: id, email, name, username, isPublic, currency (default "EUR"), hideLocationPublic, hideCostPublic -- Better Auth managed
- **Concert**: id, userId, date, latitude, longitude, venue, normalizedCity, isFestival, festivalId, cost (Decimal)
- **Band**: id, name, slug, imageUrl, websiteUrl, lastfmUrl, genres[], bio
- **Festival**: id, name, slug, url
- **ConcertBand**: concertId, bandId, isHeadliner, sortOrder (junction table)
- **Session/Account/Verification**: Better Auth tables

### Multi-Tenancy

- **Concerts** are scoped per-user via `userId` foreign key. All CRUD operations verify ownership.
- **Bands and Festivals** are shared globally across all users.
- **Public profiles** are opt-in: users set `isPublic: true` and a `username` in Settings to enable `/u/[username]`.

### Public Profiles

- Route: `/u/[username]` with ISR (1-hour revalidation)
- Displays: avatar, stats, bar chart statistics, concert map, infinite-scrolling concert list
- Only visible when `user.isPublic === true`; returns 404 otherwise

### Feature Flags

Environment-controlled in `.env`:

- `ENABLE_LASTFM` - Toggle Last.fm data enrichment
- `ENABLE_GEOCODING` - Toggle Photon reverse geocoding

### Statistics & Caching

- `getConcertStatistics()` and `getUserConcertStatistics()` use `unstable_cache` with 1-hour revalidation
- Concert create/update/delete API routes call `revalidateTag("concert-statistics")` to bust the cache
- Stats include: top years, top cities, most-seen bands (top 5 each)
- Spending aggregation: `getUserTotalSpent()` with optional filters

### Infinite Scrolling

All pages that display concert lists use infinite scrolling with cursor-based pagination:

- **Pages**: Homepage, Dashboard (My Concerts), Band pages, City pages, Year pages, Public user profiles
- **Component**: `ConcertListInfinite` (uses IntersectionObserver for automatic loading)
- **Backend**: `getConcertsPaginated()` function in `src/lib/concerts.ts` with `ConcertFilters` interface
- **API**: `/api/concerts` endpoint supports filter parameters (userId, username, bandSlug, city, year)
- **Pagination**: Cursor-based, 20 items per page by default
- **Features**:
  - Automatic scroll detection and loading
  - Bidirectional pagination (forward and backward with "Load earlier" button)
  - Deep linking support via URL cursor parameter
  - Toast notifications for errors
- **Provider**: Global `ToastProvider` in `app/providers.tsx` wraps the entire app for toast context

### Key Components

- `Dialog/` - Accessible HTML5 `<dialog>` wrapper with `aria-labelledby`, backdrop click to close, Escape key support
- `BandEditForm/` - Band metadata editing form (name, imageUrl, websiteUrl), submits PUT to `/api/bands/[slug]`
- `BandEditToggle` (in `app/band/[slug]/`) - Opens BandEditForm in a Dialog modal, refreshes page on save
- `VenueAutocomplete/` - Photon API venue search with 300ms debounce, keyboard navigation (Arrow/Enter/Escape)
- `ConcertForm/` - Concert create/edit form with band search, festival search, venue autocomplete, cost input
- `StatisticsWidgetServer` - Server component rendering bar charts from cached statistics
- `StatCard/` - Simple stat display (value + label)
- `BarChart/` - Horizontal bar chart with links to band/city/year pages
- `MapClient` - MapLibre GL map with GeoJSON clustering, popups, optional fullscreen toggle

## Code Patterns

- Server components by default; explicit `'use client'` for interactivity
- Protected routes use `export const dynamic = "force-dynamic"`
- Public routes may use ISR with `revalidate`
- TypeScript strict mode enabled
- SCSS files (not modules) co-located with components
- Absolute imports via `@/*` path alias
- Use `<Image />` from `next/image` instead of `<img>`
- Debounced API calls (300ms) for search/autocomplete inputs
- Native HTML5 `<dialog>` for modals (not third-party libraries)
- Cache tag revalidation (`revalidateTag`) on concert mutations

## Micro Animations

The app uses subtle, purposeful micro animations to provide feedback and guide attention. All animation values are defined as SCSS design tokens in `src/styles/variables.scss`:

- `$transition-duration: 200ms` -- default for hover/focus state changes
- `$transition-duration-slow: 300ms` -- for more prominent animations (bar charts, content reveals)
- `$transition-easing-decelerate: cubic-bezier(0, 0, 0.2, 1)` -- for elements entering the screen (cards, dropdowns, tags)
- `$transition-easing-accelerate: cubic-bezier(0.4, 0, 1, 1)` -- for elements leaving the screen (toast dismiss)

Existing animation patterns:

- **Card fade-in** (`card-fade-in`) -- concert cards fade + slide up on load with staggered delay via `animation-delay`
- **Dropdown fade-in** (`dropdown-fade-in`) -- search dropdowns scale + fade in from top
- **Tag enter** (`tag-enter`) -- selected band/festival tags scale in from center
- **Bar grow** (`bar-grow`) -- bar chart bars animate width from 0 on mount
- **Toast slide** (`toast-slide-in` / `toast-slide-out`) -- toasts slide in from top-right, slide out on dismiss
- **Skeleton pulse** (`skeleton-pulse`) -- loading placeholder shimmer effect
- **Copy pulse** (`copy-pulse`) -- brief highlight flash on clipboard copy confirmation
- **Hover/focus transitions** -- buttons, links, and inputs transition `background-color`, `border-color`, `color` on hover/focus

When adding new animations, always:

- Use the SCSS variables from `variables.scss` -- never hardcode durations or easings
- Keep animations subtle and functional (provide feedback, show state change, guide attention)
- Respect `prefers-reduced-motion` -- a global media query in `src/styles/layout.scss` disables all animations and transitions for users who prefer reduced motion

## Git Conventions

- Create a new branch for each new feature
- Create a new branch for each new fix
- Feature branches: `feat/NAME` or `fix/BUG` or `doc/DOC_CHANGE`
- Use "Conventional Commits" for commits: https://www.conventionalcommits.org/en/v1.0.0/

## Environment Setup

Copy `.env.example` to `.env.local` with:

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Random secret for auth
- `BETTER_AUTH_URL` - App URL (http://localhost:3000 for dev)
- `NEXT_PUBLIC_APP_URL` - Public app URL (http://localhost:3000 for dev)
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` - GitHub OAuth app

Optional:

- `LASTFM_API_KEY` and `LASTFM_SECRET` - For band data enrichment
- `NEXT_PUBLIC_MAP_STYLE_URL` - Custom MapLibre style URL (default: OpenFreeMap liberty)

## Authentication

Better Auth handles:

- GitHub OAuth login
- Session management with cookies (7-day expiry, 5-minute cookie cache)
- Route protection via middleware

Protected routes are in `app/(protected)/` and require authentication.
The middleware at `middleware.ts` handles redirects for unauthenticated users.

## API Routes

```
POST   /api/concerts              - Create concert (auth required)
GET    /api/concerts              - List concerts with filters (auth optional)
GET    /api/concerts/[id]         - Get single concert
PUT    /api/concerts/[id]         - Update concert (auth required, ownership verified)
DELETE /api/concerts/[id]         - Delete concert (auth required, ownership verified)
GET    /api/bands/search          - Search bands (for autocomplete)
POST   /api/bands                 - Create new band (auth required)
PUT    /api/bands/[slug]          - Update band info (auth required)
GET    /api/bands/[slug]/enrich   - Fetch Last.fm data (auth required)
GET    /api/festivals/search      - Search festivals (for autocomplete)
GET    /api/venues/search         - Search venues via Photon API
PUT    /api/user/profile          - Update user profile (auth required)
```
