[![Build Status](https://travis-ci.org/Juuro/concerts.svg?branch=master)](https://travis-ci.org/Juuro/concerts)

List of all the concerts I visited.
Gatsby frontend for a Contentful backend.

## Setup

### Environment Variables

The following environment variables need to be configured:

- `CONTENTFUL_SPACE_ID` - Your Contentful space ID
- `CONTENTFUL_DELIVERY_TOKEN` - Your Contentful delivery token
- `OPENCAGE_API_KEY` - Your OpenCage API key for geocoding
- `GATSBY_UNSPLASH_ACCESS_KEY` - Your Unsplash API access key for fetching band images

### Unsplash Integration

Band images are fetched from Unsplash API. To enable this feature:

1. Create an Unsplash account and register a new app at https://unsplash.com/oauth/applications
2. Get your Access Key from the app settings
3. Set the `GATSBY_UNSPLASH_ACCESS_KEY` environment variable

If the Unsplash API is not configured or fails, the app will fall back to using images from Contentful.

## Development

```bash
yarn install
yarn dev
```

## Build

```bash
yarn build
```
