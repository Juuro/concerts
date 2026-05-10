# Design Document: Concerts

## 1. Project Overview

**Concerts** is a personal concert tracking and discovery platform. It allows users to log their live music experiences, visualize their history through data and maps, and share their journey with a community of music fans.

### Core Value Propositions:

- **Beautifully Tracked History:** A digital scrapbook for every show attended.
- **Pattern Discovery:** Insightful statistics on top bands, venues, and busiest years.
- **Interactive Mapping:** A visual representation of where your music has taken you.

---

## 2. Brand Personality & Visual Style

The brand is vibrant, energetic, and clean, reflecting the excitement of live music while maintaining a high level of usability for data visualization.

- **Personality:** Passionate, Modern, Organized, Social.
- **Color Palette:**
  - **Primary (Action):** Vibrant Pink/Magenta (#FF006E) - used for primary CTAs and brand accents.
  - **Background:** Clean White/Light Gray (#FFFFFF / #F8F9FA) - provides a neutral canvas for data.
  - **Typography:** Bold, modern sans-serif for headings (e.g., Inter, Montserrat) to convey energy and clarity.
- **UI Elements:**
  - Rounded corners on cards and buttons (approx. 12-16px) for a friendly, modern feel.
  - Subtle drop shadows for depth and hierarchy.
  - Minimalist iconography for "Track," "Discover," and "Map."

---

## 3. User Personas

1.  **The Superfan:** Attends dozens of shows a year and wants a detailed archive of every setlist and venue.
2.  **The Casual Goer:** Wants a simple way to remember the few shows they attend each year and see them on a map.
3.  **The Data Nerd:** Obsessed with stats — who is their most-seen artist? What was their busiest month in 2024?

---

## 4. Key User Flows & Screens

### A. Landing Page (The Hook)

- **Hero:** Clear value prop with a "Get Started" primary CTA.
- **Social Proof:** Real-time stats (Concerts tracked, Bands, Music fans).
- **Features Grid:** High-level overview of tracking, patterns, and mapping.
- **Secondary CTA:** Final nudge to create an account.

### B. User Dashboard / Profile

- **Overview:** Summary stats (Total shows, unique artists, countries visited).
- **Recent Activity:** A feed of the most recently logged concerts.
- **Quick Add:** A prominent button to log a new show.

### C. The Log (Concert Entry)

- **Search & Add:** Integration with a music database (like Setlist.fm or MusicBrainz) to easily pull artist and venue data.
- **Personal Touch:** Ability to add photos, ratings, and personal notes.

### D. Insights & Analytics

- **Top Lists:** Most seen artists, top venues, top genres.
- **Timeline:** A year-over-year bar chart of concert frequency.
- **The Map:** An interactive globe/map with pins for every venue visited.

---

## 5. Technical Considerations

- **Responsive Design:** Must work seamlessly on mobile (for logging at the show) and desktop (for deep diving into stats).
- **Social Sharing:** Features to generate "wrapped" style graphics for Instagram/Twitter sharing.
- **Integrations:** Potential for Spotify/Last.fm integration to suggest shows based on listening history.
