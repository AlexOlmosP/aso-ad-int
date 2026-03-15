# Fair Ad Intelligence & ASO Research

> **WIP** — This project is under active development. Features may change, break, or be incomplete.

A free, open-source competitive intelligence tool for mobile app marketers. Combines **Ad Intelligence** (scrape competitor ads from Meta & Google) with **ASO Research** (keyword tracking, store listing analysis) — all without paid APIs.

## Features

### Ad Intelligence
- **Meta Ads** — Scrapes Facebook Ad Library via Playwright, intercepts GraphQL responses. Gets creatives, impressions, video/image assets, ad copy, and dates. Sorted by total impressions.
- **Google Ads** — Calls Google Ads Transparency RPC API directly. Captures ad previews as screenshots via Playwright rendering.
- **Format filtering** — Filter by Video, Image, Carousel, or All Formats.
- **Date presets** — Quick 7-day and 30-day filters, plus custom date range.

### ASO Research
- **Store Listing Overview** — Fetches app page data (subtitle, screenshots, trailer/App Preview video, description, rating, installs, in-app events) from both App Store and Google Play.
- **Keyword Tracking** — Add keywords in bulk, analyze per app.
- **Search Volume** — Estimated 1–100 popularity score based on store autocomplete and result counts.
- **Keyword Ranking** — Finds app position in search results (top 100).
- **Relevancy Detection** — Checks if keyword appears in app title, description, or metadata.
- **Apple Search Ads Detection** — Identifies if competitors are bidding on a keyword.
- **Per-store & per-country analysis** — Metrics are fetched independently for App Store vs Google Play, across 25 supported countries.

### General
- **No API keys required** — All data comes from public endpoints (Meta Ad Library, Google Ads Transparency, iTunes API, Google Play).
- **Local persistence** — Tracked apps and keywords saved to disk (`.data/` directory).
- **Multi-country support** — 25 countries + "All Countries" option.

## Tech Stack

- **Next.js 16** (Turbopack) + React 19 + TypeScript
- **Tailwind CSS 4**
- **Playwright Core** — Headless Chromium for scraping
- **google-play-scraper** — Google Play Store data
- **iTunes API** — App Store data

## Getting Started

### Prerequisites
- Node.js 18+
- Chromium for Playwright:
  ```bash
  npx playwright install chromium
  ```

### Install & Run
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Usage
1. **Search & track apps** using the sidebar search.
2. **Set advertiser IDs** — Click the ID icon on a tracked app to enter its Meta Page ID and/or Google AR ID (found on the respective ad transparency pages).
3. **Ad Intel tab** — Select a network, set filters, and hit refresh to scrape ads.
4. **ASO tab** — View store listing overview, add keywords, and analyze rankings/volume.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main UI
│   └── api/
│       ├── ads/fetch/              # Scrape ads from Meta/Google
│       ├── aso/keywords/           # Keyword analysis
│       ├── aso/store-listing/      # Store listing data
│       ├── aso/saved-keywords/     # Keyword persistence
│       ├── search-apps/            # App search
│       └── tracked-apps/           # App persistence
├── components/                     # React components
└── lib/
    ├── scrapers/                   # Playwright-based scrapers
    ├── store.tsx                   # React Context state management
    ├── types.ts                    # TypeScript interfaces
    └── countries.ts               # Supported countries
```

## Limitations

- **TikTok scraping** is not yet implemented (placeholder only).
- **Meta scraping** may fail if Facebook requires login or shows CAPTCHA.
- **Google ad previews** are rendered as screenshots — quality varies.
- **Volume scores** are estimates based on public signals, not official store data.
- **No rate limiting** — be mindful of request frequency to avoid being blocked.

## License

MIT
