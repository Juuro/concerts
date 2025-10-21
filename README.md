[![Build Status](https://travis-ci.org/Juuro/concerts.svg?branch=master)](https://travis-ci.org/Juuro/concerts)

List of all the concerts I visited.
Gatsby frontend for a Contentful backend.

## Environment Variables

The following environment variables are required:

- `CONTENTFUL_SPACE_ID` - Your Contentful space ID
- `CONTENTFUL_DELIVERY_TOKEN` - Your Contentful delivery token
- `OPENCAGE_API_KEY` - OpenCage geocoding API key
- `LASTFM_API_KEY` - Last.fm API key for fetching band images and genre information (optional, but recommended)
- `LASTFM_SECRET` - Last.fm API secret (optional)

### Getting a Last.fm API Key

1. Visit [https://www.last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Create an API account
3. Add the API key to your `.env` file or environment variables

Without a Last.fm API key, the site will fall back to using Contentful images.
