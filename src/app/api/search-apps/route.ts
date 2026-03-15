import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import type { AppSearchResult } from "@/lib/types";

// ── App Store search (web scraping, no Python needed) ──────
async function searchAppStore(
  query: string,
  country: string
): Promise<AppSearchResult[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&country=${country}&entity=software&limit=10`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map(
      (app: {
        trackId: number;
        trackName: string;
        artworkUrl100: string;
        artistName: string;
        bundleId: string;
        primaryGenreName: string;
        averageUserRating: number;
      }) => ({
        id: `appstore-${app.trackId}`,
        name: app.trackName,
        icon: app.artworkUrl100,
        developer: app.artistName,
        store: "appstore" as const,
        storeId: String(app.trackId),
        category: app.primaryGenreName,
        rating: app.averageUserRating,
      })
    );
  } catch {
    return [];
  }
}

// ── Google Play search ─────────────────────────────────────
async function searchPlayStore(
  query: string,
  country: string
): Promise<AppSearchResult[]> {
  try {
    const results = await gplay.search({
      term: query,
      num: 10,
      country,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((app: any) => ({
      id: `playstore-${app.appId}`,
      name: app.title,
      icon: app.icon,
      developer: app.developer ?? app.developerName ?? "",
      store: "playstore" as const,
      storeId: app.appId,
      category: app.genre ?? app.genreId ?? "",
      rating: parseFloat(app.scoreText ?? app.score ?? "0") || undefined,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const country = req.nextUrl.searchParams.get("country") ?? "US";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const [appStoreResults, playStoreResults] = await Promise.allSettled([
    searchAppStore(q, country),
    searchPlayStore(q, country),
  ]);

  const results: AppSearchResult[] = [
    ...(appStoreResults.status === "fulfilled" ? appStoreResults.value : []),
    ...(playStoreResults.status === "fulfilled" ? playStoreResults.value : []),
  ];

  return NextResponse.json({ results });
}
