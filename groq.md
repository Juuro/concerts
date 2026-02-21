# Natural Language Concert Search - Implementation Plan

## Overview

Add a "Help Me Remember" feature that allows users to describe concert memories in natural language and find matching concerts from Setlist.fm.

## User Flow

```
User types: "I saw Radiohead in Berlin, probably winter 2012-2015"
                ↓
         Groq API (parse natural language → structured data)
                ↓
         { artist: "Radiohead", city: "Berlin", yearStart: 2012, yearEnd: 2015, season: "winter" }
                ↓
         Query Setlist.fm API with structured params
                ↓
         Present matching concerts to user
                ↓
         User selects one → pre-fills ConcertForm
```

## Implementation Steps

### 1. Setup Groq SDK

```bash
yarn add groq-sdk
```

Add to `.env.local`:
```
GROQ_API_KEY=gsk_...
```

Add to `.env.example`:
```
GROQ_API_KEY=           # Groq API key for natural language parsing (https://console.groq.com/keys)
```

### 2. Create Concert Search Parser Utility

**File:** `src/utils/concert-search-parser.ts`

```typescript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ParsedConcertSearch {
  artist: string | null;
  city: string | null;
  venue: string | null;
  festival: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  season: "winter" | "spring" | "summer" | "fall" | null;
  month: number | null;
}

export async function parseConcertSearch(
  userInput: string
): Promise<ParsedConcertSearch> {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant", // Fast, free, good quality
    messages: [
      {
        role: "system",
        content: `You extract concert search parameters from natural language descriptions.
Return valid JSON only with these fields (use null if not mentioned):
- artist: band/artist name
- city: city name
- venue: venue name
- festival: festival name
- yearStart: earliest possible year (number)
- yearEnd: latest possible year (number, same as yearStart if single year)
- season: "winter" | "spring" | "summer" | "fall"
- month: 1-12 if specific month mentioned`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0, // Deterministic output
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}
```

### 3. Create Setlist.fm API Client

**File:** `src/utils/setlistfm.ts`

```typescript
const SETLISTFM_API_KEY = process.env.SETLISTFM_API_KEY;
const BASE_URL = "https://api.setlist.fm/rest/1.0";

export interface SetlistfmConcert {
  id: string;
  eventDate: string; // dd-MM-yyyy
  artist: { name: string; mbid: string };
  venue: { name: string; city: { name: string; country: { name: string } } };
  tour?: { name: string };
  sets?: { set: Array<{ song: Array<{ name: string }> }> };
}

export interface SetlistfmSearchParams {
  artistName?: string;
  cityName?: string;
  venueName?: string;
  year?: number;
  date?: string; // dd-MM-yyyy
  page?: number;
}

export async function searchSetlists(
  params: SetlistfmSearchParams
): Promise<{ setlists: SetlistfmConcert[]; total: number }> {
  const searchParams = new URLSearchParams();

  if (params.artistName) searchParams.set("artistName", params.artistName);
  if (params.cityName) searchParams.set("cityName", params.cityName);
  if (params.venueName) searchParams.set("venueName", params.venueName);
  if (params.year) searchParams.set("year", params.year.toString());
  if (params.date) searchParams.set("date", params.date);
  if (params.page) searchParams.set("p", params.page.toString());

  const response = await fetch(
    `${BASE_URL}/search/setlists?${searchParams.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "x-api-key": SETLISTFM_API_KEY!,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Setlist.fm API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    setlists: data.setlist || [],
    total: data.total || 0,
  };
}
```

### 4. Create Combined Search Function

**File:** `src/utils/concert-search.ts`

```typescript
import { parseConcertSearch, ParsedConcertSearch } from "./concert-search-parser";
import { searchSetlists, SetlistfmConcert } from "./setlistfm";

const SEASON_MONTHS = {
  winter: [12, 1, 2],
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  fall: [9, 10, 11],
};

export interface ConcertSearchResult {
  parsed: ParsedConcertSearch;
  concerts: SetlistfmConcert[];
}

export async function searchConcertsFromDescription(
  description: string
): Promise<ConcertSearchResult> {
  // Step 1: Parse natural language
  const parsed = await parseConcertSearch(description);

  // Step 2: Query Setlist.fm for each year in range
  const yearStart = parsed.yearStart || new Date().getFullYear();
  const yearEnd = parsed.yearEnd || yearStart;

  const allConcerts: SetlistfmConcert[] = [];

  for (let year = yearStart; year <= yearEnd; year++) {
    const results = await searchSetlists({
      artistName: parsed.artist || undefined,
      cityName: parsed.city || undefined,
      venueName: parsed.venue || undefined,
      year,
    });
    allConcerts.push(...results.setlists);
  }

  // Step 3: Filter by season/month if specified
  let filtered = allConcerts;

  if (parsed.season) {
    const months = SEASON_MONTHS[parsed.season];
    filtered = filtered.filter((concert) => {
      const [day, month] = concert.eventDate.split("-").map(Number);
      return months.includes(month);
    });
  }

  if (parsed.month) {
    filtered = filtered.filter((concert) => {
      const [day, month] = concert.eventDate.split("-").map(Number);
      return month === parsed.month;
    });
  }

  return { parsed, concerts: filtered };
}
```

### 5. Create API Route

**File:** `app/api/concerts/search-external/route.ts`

```typescript
import { NextResponse } from "next/server";
import { searchConcertsFromDescription } from "@/utils/concert-search";

export async function POST(request: Request) {
  const { query } = await request.json();

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const results = await searchConcertsFromDescription(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Concert search error:", error);
    return NextResponse.json(
      { error: "Failed to search concerts" },
      { status: 500 }
    );
  }
}
```

### 6. Create UI Component

**File:** `src/components/ConcertSearchHelper/ConcertSearchHelper.tsx`

- Text input for natural language description
- "Search" button
- Results list showing matching concerts
- "Use this concert" button that pre-fills ConcertForm

### 7. Environment Variables

Add to `.env.example`:
```
# Concert Search
GROQ_API_KEY=           # Groq API key (https://console.groq.com/keys)
SETLISTFM_API_KEY=      # Setlist.fm API key (https://api.setlist.fm)
```

## API Rate Limits

| Service | Free Tier Limit |
|---------|-----------------|
| Groq | 30 requests/min, 6000 tokens/min |
| Setlist.fm | 2 requests/sec |

## Example Queries

| User Input | Parsed Output |
|------------|---------------|
| "Radiohead in Berlin, winter 2012-2015" | `{ artist: "Radiohead", city: "Berlin", yearStart: 2012, yearEnd: 2015, season: "winter" }` |
| "Some concert at Wacken 2019" | `{ festival: "Wacken", yearStart: 2019, yearEnd: 2019 }` |
| "I saw a band in Munich, March 2023" | `{ city: "Munich", yearStart: 2023, yearEnd: 2023, month: 3 }` |

## Future Enhancements

- Cache Setlist.fm results to reduce API calls
- Add feature flag `ENABLE_CONCERT_SEARCH` to toggle feature
- Support "I was there too" by linking to shared concert entities (requires schema change)
