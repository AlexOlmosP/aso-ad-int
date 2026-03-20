import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";

interface KeywordResult {
  term: string;
  store: "appstore" | "playstore";
  searchVolume: number;
  relevant: boolean;
  appleSearchAds: boolean;
  rank: number | null;
}

// ── Shared scoring helpers (used by App Store fallback) ──────

/** Result count scaled to 0-30 range (App Store fallback only) */
function resultCountSignal(count: number): number {
  if (count >= 50) return 30;
  if (count >= 40) return 25;
  if (count >= 30) return 20;
  if (count >= 20) return 15;
  if (count >= 10) return 10;
  if (count >= 5) return 7;
  if (count >= 1) return Math.max(3, Math.round(count * 1.5));
  return 0;
}

/** Autocomplete position score for App Store fallback (0-30) */
function autocompletePositionSignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase();
  const idx = suggestions.findIndex(
    s => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase())
  );
  if (idx === -1) return 0;
  const scores = [30, 25, 20, 15, 10];
  return scores[idx] ?? 5;
}

/** Keyword density for App Store fallback (0-20) */
function keywordDensitySignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase();
  const matches = suggestions.filter(s => s.toLowerCase().includes(lower)).length;
  return Math.min(20, matches * 4);
}

// ── Play Store: improved volume signals ──────────────────────

/** Autocomplete with exact-match detection + stricter matching (0-35) */
function playAutocompleteSignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase().trim();
  if (suggestions.length === 0) return 0;

  let bestScore = 0;
  for (let i = 0; i < suggestions.length; i++) {
    const sug = suggestions[i].toLowerCase().trim();
    const isExact = sug === lower;
    // Word-boundary partial: check if term appears as a whole word
    const wordMatch = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(sug);

    let score = 0;
    if (isExact) {
      score = i === 0 ? 35 : i === 1 ? 30 : i === 2 ? 25 : 20;
    } else if (wordMatch) {
      score = i <= 1 ? 15 : 10;
    }
    bestScore = Math.max(bestScore, score);
  }
  return bestScore;
}

/** Keyword density in suggestions, rescaled (0-15) */
function playDensitySignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase();
  const matches = suggestions.filter(s => s.toLowerCase().includes(lower)).length;
  // 0=0, 1=3, 2=6, 3=9, 4=12, 5+=15
  return Math.min(15, matches * 3);
}

/** Competition intensity: how many top-10 results have the keyword in their title (0-25) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function competitionIntensitySignal(term: string, results: any[]): number {
  const lower = term.toLowerCase();
  const top10 = results.slice(0, 10);
  const titleMatches = top10.filter((r: { title?: string }) => {
    const title = (r.title ?? "").toLowerCase();
    // Word-boundary match to avoid false positives
    return new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(title);
  }).length;

  if (titleMatches >= 7) return 25;
  if (titleMatches >= 5) return 20;
  if (titleMatches >= 3) return 15;
  if (titleMatches >= 2) return 10;
  if (titleMatches >= 1) return 5;
  return 0;
}

/** Top-app installs on logarithmic scale (0-15) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function playInstallSignal(results: any[]): number {
  if (results.length === 0) return 0;
  const top5 = results.slice(0, 5);
  const avgInstalls =
    top5.reduce((sum: number, r: { minInstalls?: number }) => sum + (r.minInstalls ?? 0), 0) / top5.length;
  if (avgInstalls <= 0) return 0;
  return Math.min(15, Math.round(Math.log10(avgInstalls) * 1.5));
}

/** Google Search autocomplete cross-reference (0-10) */
async function googleSearchAutocompleteSignal(term: string): Promise<number> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(term + " app")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return 0;
    const data = await res.json();
    const suggestions: string[] = data[1] ?? [];
    const lower = term.toLowerCase();

    // Check if any suggestion contains our keyword + "app" or "game"
    const hasAppSuggestion = suggestions.some(s => {
      const sl = s.toLowerCase();
      return sl.includes(lower) && (sl.includes("app") || sl.includes("game"));
    });
    if (hasAppSuggestion) return 10;

    // Check if keyword alone appears
    const hasKeyword = suggestions.some(s => s.toLowerCase().includes(lower));
    if (hasKeyword) return 5;

    return 0;
  } catch {
    return 0; // Don't block on timeout/error
  }
}

/** Top-app rating count signal for App Store (0-20). Proxy for installs */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function topAppRatingSignal(results: any[]): number {
  if (results.length === 0) return 0;
  const top5 = results.slice(0, 5);
  const avgRatings =
    top5.reduce((sum: number, r: { userRatingCount?: number }) => sum + (r.userRatingCount ?? 0), 0) / top5.length;
  if (avgRatings >= 500_000) return 20;
  if (avgRatings >= 100_000) return 16;
  if (avgRatings >= 10_000) return 12;
  if (avgRatings >= 1_000) return 8;
  if (avgRatings >= 100) return 4;
  return 2;
}

// ── Play Store: improved multi-signal volume estimation ──────
async function estimatePlayStoreVolume(term: string, country: string): Promise<number> {
  try {
    const [results, suggestions, googleScore] = await Promise.all([
      gplay.search({ term, num: 50, country }),
      gplay.suggest({ term, country }).catch(() => [] as string[]),
      googleSearchAutocompleteSignal(term),
    ]);

    const autocomplete = playAutocompleteSignal(term, suggestions);  // 0-35
    const density = playDensitySignal(term, suggestions);            // 0-15
    const competition = competitionIntensitySignal(term, results);   // 0-25
    const installs = playInstallSignal(results);                     // 0-15
    // googleScore                                                   // 0-10

    return Math.min(100, autocomplete + density + competition + installs + googleScore);
  } catch {
    return 0;
  }
}

// ── App Store: multi-signal volume estimation ────────────────
async function estimateAppStoreVolume(term: string, country: string): Promise<number> {
  try {
    // Try Apple Search Ads popularity first (if configured)
    const asaPopularity = await fetchAsaPopularity(term, country);
    if (asaPopularity !== null) return asaPopularity;

    // Fall back to multi-signal estimation
    const [searchRes, hints] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=50`),
      fetchAppStoreHints(term),
    ]);

    let results: { userRatingCount?: number }[] = [];
    let resultCount = 0;
    if (searchRes.ok) {
      const data = await searchRes.json();
      resultCount = data.resultCount ?? 0;
      results = data.results ?? [];
    }

    const positionScore = autocompletePositionSignal(term, hints);
    const densityScore = keywordDensitySignal(term, hints);
    const ratingScore = topAppRatingSignal(results);
    const countScore = resultCountSignal(resultCount);

    return Math.min(100, positionScore + densityScore + ratingScore + countScore);
  } catch {
    return 0;
  }
}

/** Fetch App Store autocomplete hints as string array */
async function fetchAppStoreHints(term: string): Promise<string[]> {
  try {
    const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?media=software&term=${encodeURIComponent(term)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.hints ?? []).map((h: any) => h.term ?? h).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Apple Search Ads popularity (optional, requires ASA credentials) ──
async function fetchAsaPopularity(term: string, country: string): Promise<number | null> {
  const clientId = process.env.APPLE_SEARCH_ADS_CLIENT_ID;
  const clientSecret = process.env.APPLE_SEARCH_ADS_CLIENT_SECRET;
  const orgId = process.env.APPLE_SEARCH_ADS_ORG_ID;
  if (!clientId || !clientSecret || !orgId) return null;

  try {
    // Get OAuth2 token
    const tokenRes = await fetch("https://appleid.apple.com/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "searchadsorg",
      }),
    });
    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch keyword popularity
    const searchRes = await fetch(
      `https://api.searchads.apple.com/api/v5/keywords/targeting/search?query=${encodeURIComponent(term)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-AP-Context": `orgId=${orgId}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: term,
          countryOrRegion: country,
        }),
      }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    // Find exact match keyword and return its popularity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keywords = searchData.data?.keywords ?? searchData.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = keywords.find((k: any) =>
      (k.text ?? k.keyword ?? "").toLowerCase() === term.toLowerCase()
    );
    if (match?.popularity !== undefined) return match.popularity;

    // If no exact match, return first result's popularity
    if (keywords.length > 0 && keywords[0].popularity !== undefined) {
      return keywords[0].popularity;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Check relevancy: is keyword in app metadata? ───────────
async function checkRelevancy(
  appId: string,
  store: "appstore" | "playstore",
  term: string,
  appName: string,
  developer: string
): Promise<boolean> {
  const lowerTerm = term.toLowerCase();

  if (appName.toLowerCase().includes(lowerTerm)) return true;
  if (developer.toLowerCase().includes(lowerTerm)) return true;

  try {
    if (store === "playstore") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app: any = await gplay.app({ appId });
      const metadata = [
        app.title,
        app.summary,
        app.description,
        app.developer,
        app.genre ?? app.genreId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return metadata.includes(lowerTerm);
    } else {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${appId}&country=US`
      );
      if (!res.ok) return false;
      const data = await res.json();
      const app = data.results?.[0];
      if (!app) return false;
      const metadata = [
        app.trackName,
        app.description,
        app.artistName,
        app.primaryGenreName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return metadata.includes(lowerTerm);
    }
  } catch {
    return false;
  }
}

// ── Check Apple Search Ads: are competitors bidding? ───────
async function checkAppleSearchAds(
  term: string,
  country: string
): Promise<boolean> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&country=${country}&entity=software&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    const results = data.results ?? [];
    if (results.length === 0) return false;

    const topName = (results[0].trackName ?? "").toLowerCase();
    return !topName.includes(term.toLowerCase());
  } catch {
    return false;
  }
}

// ── Check keyword ranking position ─────────────────────────
async function checkRanking(
  appId: string,
  store: "appstore" | "playstore",
  term: string,
  country: string
): Promise<number | null> {
  try {
    if (store === "playstore") {
      const results = await gplay.search({ term, num: 100, country });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const index = results.findIndex((r: any) => r.appId === appId);
      return index >= 0 ? index + 1 : null;
    } else {
      // App Store: search and find position
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        term
      )}&country=${country}&entity=software&limit=100`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const results = data.results ?? [];
      const index = results.findIndex(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => String(r.trackId) === String(appId)
      );
      return index >= 0 ? index + 1 : null;
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    appId,
    store,
    keywords: terms,
    country,
    appName,
    developer,
  } = body as {
    appId: string;
    store: "appstore" | "playstore";
    keywords: string[];
    country: string;
    appName: string;
    developer: string;
  };

  if (!appId || !terms?.length) {
    return NextResponse.json({ keywords: [] });
  }

  // "All Countries" isn't valid for store APIs — default to US
  const effectiveCountry = country === "ALL" ? "US" : country;

  const keywordResults: KeywordResult[] = await Promise.all(
    terms.map(async (term: string) => {
      const [volume, relevant, asa, rank] = await Promise.all([
        store === "playstore"
          ? estimatePlayStoreVolume(term, effectiveCountry)
          : estimateAppStoreVolume(term, effectiveCountry),
        checkRelevancy(appId, store, term, appName, developer),
        store === "appstore" ? checkAppleSearchAds(term, effectiveCountry) : Promise.resolve(false),
        checkRanking(appId, store, term, effectiveCountry),
      ]);

      return {
        term,
        store,
        searchVolume: volume,
        relevant,
        appleSearchAds: asa,
        rank,
      };
    })
  );

  return NextResponse.json({ keywords: keywordResults });
}
