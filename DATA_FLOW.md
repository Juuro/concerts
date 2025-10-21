# Unsplash Integration Data Flow

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User visits page                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ConcertCard Component                         │
│  - Renders concert information                                   │
│  - Needs band image for background                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                useEffect Hook (on mount)                         │
│  - Calls loadBandImage() function                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              fetchBandImage(bandName)                            │
│  - From src/utils/unsplash.js                                   │
│  - Searches Unsplash for "{bandName} band music"                │
└─────────────┬───────────────────────────────┬───────────────────┘
              │                               │
              │ Success                       │ Failure / Not Configured
              ▼                               ▼
┌──────────────────────────┐   ┌─────────────────────────────────┐
│  Returns image object    │   │    Returns null                 │
│  - url                   │   │                                 │
│  - thumb                 │   │                                 │
│  - alt                   │   │                                 │
│  - photographer          │   │                                 │
│  - photographerUrl       │   │                                 │
└──────────┬───────────────┘   └────────────┬────────────────────┘
           │                                 │
           └────────────┬────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│            getBandImageUrl(band, unsplashImage)                  │
│  - Checks if Unsplash image available → use it                  │
│  - Otherwise checks Contentful image → use it                   │
│  - Otherwise returns null                                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Image URL set in state                            │
│  - Component re-renders with image                              │
│  - Background image style applied                               │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow Details

### Step 1: Component Mount
```javascript
useEffect(() => {
  const loadBandImage = async () => {
    if (concert.bands && concert.bands.length > 0) {
      const image = await fetchBandImage(concert.bands[0].name)
      setBandImage(image)
    }
    setIsLoading(false)
  }
  
  loadBandImage()
}, [concert.bands])
```

### Step 2: Unsplash API Call
```javascript
const result = await api.search.getPhotos({
  query: `${bandName} band music`,
  page: 1,
  perPage: 1,
  orientation: "landscape",
})
```

### Step 3: Image URL Resolution
```javascript
// Priority order:
1. Unsplash image (if available)
2. Contentful image (fallback)
3. null (no image)
```

## Error Handling

```
API Error → Log to console → Return null → Use Contentful fallback
Missing API Key → Log warning → Return null → Use Contentful fallback
No results → Return null → Use Contentful fallback
Network error → Log error → Return null → Use Contentful fallback
```

## State Management

```javascript
// Component State
const [bandImage, setBandImage] = useState(null)
const [isLoading, setIsLoading] = useState(true)

// State transitions:
null → loading → image loaded (success)
null → loading → null (failure, uses Contentful)
```

## Pages Using This Integration

- **/** (Home) - All concerts
- **/band/:slug** - Concerts by specific band
- **/year/:year** - Concerts by year
- **/city/:city** - Concerts by city

All use ConcertCard component, so all benefit from Unsplash integration.
