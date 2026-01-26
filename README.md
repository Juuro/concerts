[![Build Status](https://travis-ci.org/Juuro/concerts.svg?branch=master)](https://travis-ci.org/Juuro/concerts)

List of all the concerts I visited.
Next.js frontend for a Contentful backend.

## Getting Started

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- Yarn package manager
- Contentful account with concert data
- Photon reverse geocoding (no API key; please be fair with usage)
- Last.fm API keys (optional)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your API credentials in `.env.local`

5. Start the development server:
```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier

## Environment Variables

The following environment variables are required:

- `CONTENTFUL_SPACE_ID` - Your Contentful space ID
- `CONTENTFUL_DELIVERY_TOKEN` - Your Contentful delivery token
- `PHOTON_BASE_URL` - Optional base URL for Photon (defaults to `https://photon.komoot.io`)
- `LASTFM_API_KEY` - Last.fm API key for fetching band images and genre information (optional, but recommended)
- `LASTFM_SECRET` - Last.fm API secret (optional)

### Getting a Last.fm API Key

1. Visit [https://www.last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Create an API account
3. Add the API key to your `.env` file or environment variables

Without a Last.fm API key, the site will fall back to using Contentful images.

## Migration from Gatsby

This project was migrated from Gatsby to Next.js 15. See [MIGRATION.md](MIGRATION.md) for details about the migration process and changes.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **React 18** - UI library
- **Contentful** - Headless CMS
- **Leaflet** - Interactive maps
- **SCSS** - Styling
- **Last.fm API** - Artist metadata
- **Photon** - Reverse geocoding
