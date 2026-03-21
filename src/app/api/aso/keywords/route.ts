import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import {
  estimatePlayStoreVolume,
  estimateAppStoreVolume,
} from "@/lib/volume-estimation";

interface KeywordResult {
  term: string;
  store: "appstore" | "playstore";
  searchVolume: number;
  relevant: boolean;
  appleSearchAds: boolean;
  rank: number | null;
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
