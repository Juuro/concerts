# Migration from Gatsby to Next.js

This document outlines the migration of the Concerts application from Gatsby to Next.js 15 (App Router).

## Key Changes

### Framework Migration
- **From:** Gatsby 5.14.1
- **To:** Next.js 15.5.9 with App Router

### Architecture Changes

1. **Data Fetching**
   - Replaced Gatsby's GraphQL layer with direct Contentful SDK calls
   - Created `/src/utils/data.js` for centralized data fetching functions
   - Data is fetched at build time using Next.js server components

2. **Routing**
   - Migrated from `src/pages/` to `app/` directory (App Router)
   - Dynamic routes now use bracket notation:
     - `/band/[slug]` instead of programmatic page creation
     - `/city/[slug]` for city pages
     - `/year/[year]` for year pages

3. **Components**
   - Created Next.js-specific component versions (suffixed with `-next.js`)
   - Replaced `gatsby-link` with `next/link`
   - Made components server components by default, with `'use client'` for interactive components

4. **Static Site Generation**
   - Using `generateStaticParams` for dynamic routes instead of `createPages` in `gatsby-node.js`
   - Build-time data fetching with async server components

5. **Environment Variables**
   - Next.js uses the same environment variables as Gatsby
   - Create `.env.local` based on `.env.example`

### File Structure

```
/app
  /band/[slug]/page.js        # Band detail pages
  /city/[slug]/page.js        # City pages
  /year/[year]/page.js        # Year pages
  /map/page.js                # Map view
  layout.js                   # Root layout
  page.js                     # Home page
  not-found.js                # 404 page

/src
  /components                 # React components
    *-next.js                 # Next.js-specific versions
  /utils
    contentful.js             # Contentful client
    data.js                   # Data fetching functions
    lastfm.js                 # Last.fm API integration
```

### Dependencies Changes

**Removed:**
- All `gatsby-*` packages
- `bluebird` (Promise library, using native Promises)
- `path` (Node.js built-in)

**Added:**
- `next` - Next.js framework
- `contentful` - Contentful SDK
- `eslint` & `eslint-config-next` - Linting support

**Kept:**
- React 18
- Contentful integration (via SDK instead of gatsby-source-contentful)
- Last.fm integration
- OpenCage geocoding
- Leaflet maps
- SCSS support
- All UI components

### Build & Development

**Gatsby commands:**
```bash
yarn dev          # Start dev server
yarn build        # Build for production
yarn serve        # Serve production build
```

**Next.js commands:**
```bash
yarn dev          # Start dev server (http://localhost:3000)
yarn build        # Build for production
yarn start        # Start production server
yarn lint         # Run ESLint
```

### Configuration Files

**Removed:**
- `gatsby-config.js`
- `gatsby-node.js`
- `gatsby-browser.js`
- `gatsby-ssr.js`

**Added:**
- `next.config.mjs` - Next.js configuration
- `.eslintrc.json` - ESLint configuration

**Updated:**
- `package.json` - Scripts and dependencies
- `.gitignore` - Next.js build artifacts

### API Integration

The application still uses the same external APIs:
- **Contentful** - CMS for concert and band data
- **Last.fm** - Artist metadata and genres
- **OpenCage** - Geocoding for concert locations
- **Mapbox** - Map tiles for the map view

### Known Differences

1. **Image Handling**
   - Next.js `<Image>` component could be used for optimized images
   - Currently using standard `<img>` tags with Contentful URLs

2. **Client-Side Components**
   - Interactive components (Map, Statistics) are marked with `'use client'`
   - Server components are used for data fetching and layout

3. **Build Time**
   - Static generation happens at build time
   - Requires valid API credentials to build

### Migration Checklist

- [x] Update dependencies
- [x] Create Next.js configuration
- [x] Migrate pages to App Router
- [x] Create data fetching utilities
- [x] Update components to use Next.js APIs
- [x] Set up dynamic routes with `generateStaticParams`
- [x] Configure SCSS support
- [x] Update environment variable handling
- [x] Add ESLint configuration
- [ ] Test with actual Contentful data
- [ ] Deploy to production hosting

### Deployment Notes

Next.js can be deployed to:
- **Vercel** (recommended, zero-config)
- **Netlify**
- **AWS Amplify**
- **Any Node.js hosting** (using `yarn start`)
- **Static hosting** (using `yarn build` with `output: 'export'` in next.config.mjs)

For static export (like Gatsby), add to `next.config.mjs`:
```javascript
const nextConfig = {
  output: 'export',
  // ... other config
};
```

Note: Some features like ISR (Incremental Static Regeneration) require a Node.js server.

### Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in your API credentials:
   - Contentful Space ID and Delivery Token
   - OpenCage API Key
   - Last.fm API Key (optional)
3. Run `yarn install`
4. Run `yarn dev` for development or `yarn build` for production

### Breaking Changes

None for end users - the application functionality remains the same. The migration is purely internal.

### Performance Improvements

- Next.js 15 uses React 18 with automatic batching
- Faster build times with Turbopack (in development)
- Better code splitting and tree shaking
- Image optimization available via Next.js Image component

### Future Enhancements

Potential improvements now possible with Next.js:
- Server-side rendering for real-time data
- Incremental Static Regeneration for periodic updates
- API routes for backend functionality
- Middleware for authentication or redirects
- Built-in image optimization
- Automatic font optimization
