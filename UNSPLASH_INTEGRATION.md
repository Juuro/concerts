# Unsplash API Integration

This document explains the Unsplash API integration for fetching band images.

## Overview

The concerts app now integrates with the Unsplash API to dynamically fetch band images based on band names. This replaces or supplements the static images stored in Contentful.

## Implementation Details

### 1. New Dependencies

- **unsplash-js** (v7.0.20): Official JavaScript SDK for the Unsplash API

### 2. New Files

- **src/utils/unsplash.js**: Utility module for Unsplash API integration
  - `initUnsplash()`: Initializes the Unsplash API client
  - `fetchBandImage(bandName)`: Fetches band images from Unsplash
  - `getBandImageUrl(band, unsplashImage)`: Helper to get image URL with Contentful fallback

### 3. Modified Files

- **src/components/ConcertCard/concertCard.js**: Updated to fetch and display Unsplash images
  - Added React hooks (useState, useEffect) for async image loading
  - Fetches Unsplash image when component mounts
  - Falls back to Contentful image if Unsplash fails

### 4. Configuration

The integration requires the `GATSBY_UNSPLASH_ACCESS_KEY` environment variable:

```bash
GATSBY_UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

To get an access key:
1. Create an account at https://unsplash.com
2. Register a new app at https://unsplash.com/oauth/applications
3. Copy the Access Key from your app settings

## Features

- **Automatic fallback**: If Unsplash API is not configured or fails, the app falls back to Contentful images
- **Search optimization**: Searches for "{bandName} band music" to get relevant results
- **Landscape orientation**: Requests landscape-oriented images for better display in concert cards
- **Error handling**: Gracefully handles API errors without breaking the UI

## Usage

Images are automatically fetched and displayed in:
- **Home page**: Concert cards showing band images
- **Band pages**: Concert cards for each band's concerts

No additional code changes are required to use this feature once the environment variable is set.

## Performance Considerations

- Images are fetched client-side when components mount
- Each concert card fetches its band image independently
- Consider implementing caching in the future to reduce API calls

## Future Improvements

- Add image caching to reduce API calls
- Implement image preloading for better UX
- Add support for multiple image sources
- Store fetched URLs in local storage
