# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 web application displaying a personal concert attendance collection. Uses Contentful CMS for data, Leaflet for interactive maps, and enriches metadata via Last.fm API and Photon reverse geocoding.

## Commands

```bash
yarn dev          # Start development server (localhost:3000)
yarn build        # Production build (runs prefetch scripts then next build)
yarn lint         # ESLint with next/core-web-vitals
yarn format       # Prettier formatting
yarn release      # Semantic versioning with standard-version
```

The build command runs sequentially:
1. `scripts/prefetch-lastfm.mjs` - Fetches Last.fm band metadata
2. `scripts/prefetch-geocoding.mjs` - Reverse geocodes concert coordinates
3. `next build` - Generates static pages

## Architecture

### Data Flow

1. **Build time**: Prefetch scripts cache Last.fm and geocoding data to `.next/cache/`
2. **Runtime**: Server components fetch from Contentful, enriched with cached data
3. **Static generation**: All pages pre-rendered via `generateStaticParams()`

### Key Directories

- `app/` - Next.js 15 App Router pages (band/city/year dynamic routes)
- `src/components/` - React components with `.module.scss` co-located styles
- `src/utils/data.ts` - Main data fetching functions (`getAllConcerts`, `getAllBands`, etc.)
- `src/utils/contentful.ts` - Contentful client initialization
- `src/types/` - TypeScript type definitions
- `scripts/` - Build-time prefetch scripts with rate limiting

### Contentful Schema

- **Concert**: date, city (lat/lon), club, bands[], isFestival, festival
- **Band**: name, slug, image
- **Festival**: name, url

### Feature Flags

Environment-controlled in `.env`:
- `ENABLE_LASTFM` - Toggle Last.fm data enrichment
- `ENABLE_GEOCODING` - Toggle city name geocoding

## Code Patterns

- Server components by default; explicit `'use client'` for interactivity
- All pages use `export const dynamic = "force-static"`
- TypeScript strict mode enabled
- SCSS Modules required (no Tailwind or CSS-in-JS)
- Absolute imports via `@/*` path alias
- Feature branches: `feat/NAME` or `fix/BUG`

## Environment Setup

Copy `.env.example` to `.env.local` with:
- `CONTENTFUL_SPACE_ID` and `CONTENTFUL_DELIVERY_TOKEN` (required)
- `LASTFM_API_KEY` and `LASTFM_SECRET` (optional)
- `PHOTON_BASE_URL` (defaults to photon.komoot.io)

## API Rate Limiting

Prefetch scripts implement:
- 700ms minimum request interval
- 60s cooldown after 429 responses
- 8s request timeout
- 5-minute build time budget with soft-fail
