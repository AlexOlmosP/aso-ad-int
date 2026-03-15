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

// ── Deterministic result-count → 1-100 score mapping ─────
function resultCountToScore(count: number): number {
  if (count >= 50) return 80;
  if (count >= 40) return 70;
  if (count >= 30) return 60;
  if (count >= 20) return 50;
  if (count >= 10) return 38;
  if (count >= 5) return 25;
  if (count >= 1) return Math.max(10, count * 5);
  return 5;
}

// ── Estimate search volume via Play Store results + autocomplete ─────
async function estimatePlayStoreVolume(term: string, country: string): Promise<number> {
  try {
    const [results, inAutocomplete] = await Promise.all([
      gplay.search({ term, num: 50, country }),
      checkPlayStoreAutocomplete(term, country),
    ]);
    let score = resultCountToScore(results.length);
    if (inAutocomplete) score = Math.min(100, score + 15);
    return score;
  } catch {
    return 0;
  }
}

async function checkPlayStoreAutocomplete(term: string, country: string): Promise<boolean> {
  try {
    const suggestions: string[] = await gplay.suggest({ term, country });
    const lower = term.toLowerCase();
    return suggestions.some(s =>
      s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase())
    );
  } catch {
    return false;
  }
}

// ── Estimate App Store search volume via iTunes API + autocomplete ────
async function estimateAppStoreVolume(term: string, country: string): Promise<number> {
  try {
    const [searchRes, inAutocomplete] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=50`),
      checkAppStoreAutocomplete(term),
    ]);
    if (!searchRes.ok) return 0;
    const data = await searchRes.json();
    const count = data.resultCount ?? 0;
    let score = resultCountToScore(count);
    if (inAutocomplete) score = Math.min(100, score + 15);
    return score;
  } catch {
    return 0;
  }
}

async function checkAppStoreAutocomplete(term: string): Promise<boolean> {
  try {
    const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?media=software&term=${encodeURIComponent(term)}`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hints: string[] = (data.hints ?? []).map((h: any) => h.term ?? h).filter(Boolean);
    const lower = term.toLowerCase();
    return hints.some(h =>
      h.toLowerCase().includes(lower) || lower.includes(h.toLowerCase())
    );
  } catch {
    return false;
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
