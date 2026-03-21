import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import type { KeywordSuggestion } from "@/lib/types";
import {
  estimatePlayStoreVolume,
  estimateAppStoreVolume,
  estimateDifficulty,
} from "@/lib/volume-estimation";

type CandidateTerm = { term: string; source: KeywordSuggestion["source"] };

// ── Fetch app on-metadata text ──────────────────────────────
async function getAppMetadataText(
  appId: string,
  store: "appstore" | "playstore",
  country: string
): Promise<string> {
  try {
    if (store === "playstore") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app: any = await gplay.app({ appId, country });
      return [
        app.title,
        app.summary,
        app.description,
        app.developer,
        app.genre ?? app.genreId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    } else {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${appId}&country=${country}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return "";
      const data = await res.json();
      const app = data.results?.[0];
      if (!app) return "";
      return [
        app.trackName,
        app.description,
        app.artistName,
        app.primaryGenreName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    }
  } catch {
    return "";
  }
}

// ── Check if a term is already in the app's on-metadata ─────
function isInMetadata(term: string, metadataText: string): boolean {
  const lower = term.toLowerCase().trim();
  if (lower.length < 3) return false;

  // Check if the full term appears in metadata
  if (metadataText.includes(lower)) return true;

  // For multi-word terms, check if all words appear
  const words = lower.split(/\s+/).filter(w => w.length >= 3);
  if (words.length > 1) {
    return words.every(w => metadataText.includes(w));
  }

  return false;
}

// ── Find keywords the app ranks for but doesn't have in metadata ──
async function findRankingKeywords(
  appId: string,
  store: "appstore" | "playstore",
  appName: string,
  country: string,
  metadataText: string
): Promise<CandidateTerm[]> {
  const candidates: CandidateTerm[] = [];

  try {
    if (store === "playstore") {
      // Get autocomplete suggestions for generic category terms
      const nameWords = appName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(w => w.length >= 3);

      // Search for the app by name to find related keywords
      const searchResults = await gplay.search({ term: appName, num: 50, country });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appIndex = searchResults.findIndex((r: any) => r.appId === appId);

      if (appIndex >= 0 && appIndex < 100) {
        // App ranks for its own name — now find other terms it might rank for
        // Extract keywords from competitor titles that might also apply
        const competitors = searchResults
          .filter((r) => r.appId !== appId)
          .slice(0, 10);

        for (const comp of competitors) {
          const titleWords = (comp.title ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter(w => w.length >= 3 && !nameWords.includes(w));

          for (const word of titleWords) {
            if (!isInMetadata(word, metadataText)) {
              candidates.push({ term: word, source: "competitor" });
            }
          }
        }
      }

      // Also try category-related searches
      for (const word of nameWords.slice(0, 3)) {
        try {
          const results = await gplay.search({ term: word, num: 100, country });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idx = results.findIndex((r: any) => r.appId === appId);
          if (idx >= 0 && idx < 100) {
            // App ranks for this keyword — if not in metadata, it's a suggestion
            if (!isInMetadata(word, metadataText)) {
              candidates.push({ term: word, source: "competitor" });
            }
          }
        } catch {
          // Skip on error
        }
      }
    } else {
      // App Store: search and find ranking position
      const nameWords = appName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(w => w.length >= 3);

      for (const word of nameWords.slice(0, 3)) {
        try {
          const res = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(word)}&country=${country}&entity=software&limit=100`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (!res.ok) continue;
          const data = await res.json();
          const results = data.results ?? [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idx = results.findIndex((r: any) => String(r.trackId) === String(appId));
          if (idx >= 0 && idx < 100 && !isInMetadata(word, metadataText)) {
            candidates.push({ term: word, source: "competitor" });
          }
        } catch {
          // Skip on error
        }
      }
    }
  } catch {
    // Return what we have
  }

  return candidates;
}

// ── Play Store keyword suggestion logic ────────────────────
async function getPlayStoreSuggestions(
  appId: string,
  appName: string,
  country: string,
  metadataText: string
): Promise<KeywordSuggestion[]> {
  const seen = new Set<string>();

  // Build seed terms from app name words (2+ chars)
  const nameWords = appName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const seedTerms = [appName, ...nameWords];

  // 1. Get autocomplete suggestions for each seed term
  const autocompletePromises = seedTerms.map(async (seed): Promise<CandidateTerm[]> => {
    try {
      const results = await gplay.suggest({ term: seed, country });
      return results.map((r) => ({
        term: typeof r === "string" ? r : (r as { term?: string }).term ?? String(r),
        source: "autocomplete" as const,
      }));
    } catch {
      return [];
    }
  });

  // 2. Search top 5 competitor apps and extract title keywords
  const competitorPromise = (async () => {
    try {
      const searchResults = await gplay.search({ term: appName, num: 6, country });
      const competitors = searchResults
        .filter((r) => r.appId !== appId)
        .slice(0, 5);

      const terms: CandidateTerm[] = [];
      for (const comp of competitors) {
        const titleWords = (comp.title ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length >= 3);
        for (const word of titleWords) {
          terms.push({ term: word, source: "competitor" });
        }
        if (comp.title) {
          terms.push({ term: comp.title.toLowerCase(), source: "competitor" });
        }
      }
      return terms;
    } catch {
      return [];
    }
  })();

  // 3. Google suggest cross-reference
  const googlePromise = (async (): Promise<CandidateTerm[]> => {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(appName + " app")}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return [];
      const data = await res.json();
      const googleSuggestions: string[] = data[1] ?? [];
      return googleSuggestions.map((s) => ({
        term: s.replace(/\s*app\s*$/i, "").trim(),
        source: "google-search" as const,
      }));
    } catch {
      return [];
    }
  })();

  // 4. Find keywords the app ranks for but not in metadata
  const rankingPromise = findRankingKeywords(appId, "playstore", appName, country, metadataText);

  const [autocompleteResults, competitorResults, googleResults, rankingResults] = await Promise.all([
    Promise.all(autocompletePromises),
    competitorPromise,
    googlePromise,
    rankingPromise,
  ]);

  // Flatten all candidates
  const allCandidates: CandidateTerm[] = [];
  for (const batch of autocompleteResults) {
    allCandidates.push(...batch);
  }
  allCandidates.push(...competitorResults);
  allCandidates.push(...googleResults);
  allCandidates.push(...rankingResults);

  // Deduplicate and filter out on-metadata keywords
  const filtered: CandidateTerm[] = [];
  for (const candidate of allCandidates) {
    const normalized = candidate.term.toLowerCase().trim();
    if (!normalized || normalized.length < 2) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    // Skip keywords already in the app's on-metadata
    if (isInMetadata(normalized, metadataText)) continue;

    filtered.push({ ...candidate, term: normalized });
  }

  // Score each term using the same volume estimation as tracked keywords
  const scored = await Promise.all(
    filtered.slice(0, 40).map(async (entry) => {
      try {
        const [volume, searchResults] = await Promise.all([
          estimatePlayStoreVolume(entry.term, country),
          gplay.search({ term: entry.term, num: 10, country }).catch(() => []),
        ]);
        const difficulty = estimateDifficulty(entry.term, searchResults);
        return { ...entry, estimatedVolume: volume, difficulty };
      } catch {
        return { ...entry, estimatedVolume: 0, difficulty: "low" as const };
      }
    })
  );

  // Sort by volume descending and cap at 20
  scored.sort((a, b) => b.estimatedVolume - a.estimatedVolume);
  return scored.slice(0, 20);
}

// ── App Store keyword suggestion logic ─────────────────────
async function getAppStoreSuggestions(
  appId: string,
  appName: string,
  country: string,
  metadataText: string
): Promise<KeywordSuggestion[]> {
  const seen = new Set<string>();

  const nameWords = appName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const seedTerms = [appName, ...nameWords];

  // 1. App Store hints autocomplete
  const autocompletePromises = seedTerms.map(async (seed): Promise<CandidateTerm[]> => {
    try {
      const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?media=software&term=${encodeURIComponent(seed)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return [];
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hints: string[] = (data.hints ?? []).map((h: any) => h.term ?? h).filter(Boolean);
      return hints.map((term) => ({ term, source: "autocomplete" as const }));
    } catch {
      return [];
    }
  });

  // 2. Competitor title keywords via iTunes search
  const competitorPromise = (async () => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(appName)}&country=${country}&entity=software&limit=6`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = data.results ?? [];
      const competitors = results
        .filter((r) => String(r.trackId) !== String(appId))
        .slice(0, 5);

      const terms: CandidateTerm[] = [];
      for (const comp of competitors) {
        const titleWords = (comp.trackName ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w: string) => w.length >= 3);
        for (const word of titleWords) {
          terms.push({ term: word, source: "competitor" });
        }
        if (comp.trackName) {
          terms.push({ term: comp.trackName.toLowerCase(), source: "competitor" });
        }
      }
      return terms;
    } catch {
      return [];
    }
  })();

  // 3. Google suggest cross-reference
  const googlePromise = (async (): Promise<CandidateTerm[]> => {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(appName + " app")}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return [];
      const data = await res.json();
      const googleSuggestions: string[] = data[1] ?? [];
      return googleSuggestions.map((s) => ({
        term: s.replace(/\s*app\s*$/i, "").trim(),
        source: "google-search" as const,
      }));
    } catch {
      return [];
    }
  })();

  // 4. Find keywords the app ranks for but not in metadata
  const rankingPromise = findRankingKeywords(appId, "appstore", appName, country, metadataText);

  const [autocompleteResults, competitorResults, googleResults, rankingResults] = await Promise.all([
    Promise.all(autocompletePromises),
    competitorPromise,
    googlePromise,
    rankingPromise,
  ]);

  // Flatten and deduplicate, filtering out on-metadata keywords
  const filtered: CandidateTerm[] = [];
  for (const batch of autocompleteResults) {
    for (const candidate of batch) {
      const normalized = candidate.term.toLowerCase().trim();
      if (!normalized || normalized.length < 2) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      if (isInMetadata(normalized, metadataText)) continue;
      filtered.push({ ...candidate, term: normalized });
    }
  }
  for (const candidate of [...competitorResults, ...googleResults, ...rankingResults]) {
    const normalized = candidate.term.toLowerCase().trim();
    if (!normalized || normalized.length < 2) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (isInMetadata(normalized, metadataText)) continue;
    filtered.push({ ...candidate, term: normalized });
  }

  // Score each term using the same volume estimation as tracked keywords
  const scored = await Promise.all(
    filtered.slice(0, 40).map(async (entry) => {
      try {
        const [volume, searchRes] = await Promise.all([
          estimateAppStoreVolume(entry.term, country),
          fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(entry.term)}&country=${country}&entity=software&limit=10`,
            { signal: AbortSignal.timeout(5000) }
          ).catch(() => null),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let results: any[] = [];
        if (searchRes?.ok) {
          const data = await searchRes.json();
          results = data.results ?? [];
        }
        const difficulty = estimateDifficulty(entry.term, results);
        return { ...entry, estimatedVolume: volume, difficulty };
      } catch {
        return { ...entry, estimatedVolume: 0, difficulty: "low" as const };
      }
    })
  );

  scored.sort((a, b) => b.estimatedVolume - a.estimatedVolume);
  return scored.slice(0, 20);
}

// ── POST handler ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appId, store, country, appName, developer } = body as {
      appId: string;
      store: "appstore" | "playstore";
      country: string;
      appName: string;
      developer: string;
    };

    if (!appId || !appName) {
      return NextResponse.json(
        { error: "Missing required fields: appId, appName" },
        { status: 400 }
      );
    }

    const effectiveCountry = country === "ALL" ? "US" : country;
    void developer;

    // Fetch app metadata once to filter suggestions
    const metadataText = await getAppMetadataText(appId, store, effectiveCountry);

    let suggestions: KeywordSuggestion[];

    if (store === "playstore") {
      suggestions = await getPlayStoreSuggestions(appId, appName, effectiveCountry, metadataText);
    } else {
      suggestions = await getAppStoreSuggestions(appId, appName, effectiveCountry, metadataText);
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[KeywordSuggestions] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate keyword suggestions" },
      { status: 500 }
    );
  }
}
