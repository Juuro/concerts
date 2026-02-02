# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 multi-tenant web application for tracking personal concert attendance. Features user authentication via Better Auth, PostgreSQL database via Prisma, Leaflet for interactive maps, and Last.fm API integration for band metadata enrichment.

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

# Migration from Contentful (one-time)
yarn migrate:contentful  # Import data from Contentful to PostgreSQL
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
  - `(protected)/` - Protected routes requiring auth (dashboard, settings)
  - `u/[username]/` - Public user profiles
  - `api/` - API routes for CRUD operations
- `src/components/` - React components with `.scss` co-located styles
- `src/lib/` - Core libraries
  - `prisma.ts` - Prisma client singleton
  - `auth.ts` - Better Auth server configuration
  - `auth-client.ts` - Better Auth client
  - `concerts.ts` - Concert CRUD operations
  - `bands.ts` - Band operations
  - `festivals.ts` - Festival operations
- `src/types/` - TypeScript type definitions
- `prisma/` - Prisma schema and migrations

### Database Schema

- **User**: id, email, name, username, isPublic (Better Auth managed)
- **Concert**: id, userId, date, lat/lon, city, club, isFestival, festivalId
- **Band**: id, name, slug, imageUrl, lastfmUrl, genres[], bio
- **Festival**: id, name, slug, url
- **ConcertBand**: concertId, bandId, isHeadliner, sortOrder (junction table)
- **Session/Account/Verification**: Better Auth tables

### Feature Flags

Environment-controlled in `.env`:

- `ENABLE_LASTFM` - Toggle Last.fm data enrichment

## Code Patterns

- Server components by default; explicit `'use client'` for interactivity
- Protected routes use `export const dynamic = "force-dynamic"`
- Public routes may use ISR with `revalidate`
- TypeScript strict mode enabled
- SCSS files (not modules) co-located with components
- Absolute imports via `@/*` path alias
- Use `<Image />` from `next/image` instead of `<img>`

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
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` - GitHub OAuth app

Optional:

- `LASTFM_API_KEY` and `LASTFM_SECRET` - For band data enrichment

## Authentication

Better Auth handles:

- GitHub OAuth login
- Session management with cookies
- Route protection via middleware

Protected routes are in `app/(protected)/` and require authentication.
The middleware at `middleware.ts` handles redirects for unauthenticated users.

## API Routes

```
POST   /api/concerts          - Create concert (auth required)
GET    /api/concerts          - List user's concerts (auth required)
PUT    /api/concerts/[id]     - Update concert (auth required)
DELETE /api/concerts/[id]     - Delete concert (auth required)
GET    /api/bands/search      - Search bands (for autocomplete)
POST   /api/bands             - Create new band (auth required)
GET    /api/bands/[slug]/enrich - Fetch Last.fm data (auth required)
PUT    /api/user/profile      - Update user profile (auth required)
```
