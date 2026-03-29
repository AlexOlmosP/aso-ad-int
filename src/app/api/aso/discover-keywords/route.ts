import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import type { DiscoveredKeyword } from "@/lib/types";
import {
  estimatePlayStoreVolume,
  estimateAppStoreVolume,
} from "@/lib/volume-estimation";

// ── Stop words to filter out ─────────────────────────────────
const STOP_WORDS = new Set([
  "the", "and", "for", "app", "game", "games", "free", "new", "best", "top",
  "play", "with", "you", "your", "this", "that", "from", "are", "was", "all",
  "more", "one", "not", "but", "can", "get", "has", "have", "had", "her",
  "his", "how", "its", "may", "our", "out", "pro", "use", "now", "also",
  "just", "like", "make", "will", "than", "them", "then", "into", "been",
  "each", "most", "only", "over", "such", "very", "when", "come", "made",
  "find", "here", "know", "take", "want", "does", "let", "say", "she",
  "too", "own", "any", "day", "same", "tell", "real", "keep", "help",
  "try", "off", "add", "big", "old", "way", "still", "every", "about",
  "world", "much", "through", "back", "where", "after", "other", "down",
]);

// ── Check ranking position ───────────────────────────────────
async function checkPlayStoreRank(
  term: string,
  appId: string,
  country: string
): Promise<number | null> {
  try {
    const results = await gplay.search({ term, num: 100, country });
    const idx = results.findIndex((r) => r.appId === appId);
    return idx >= 0 ? idx + 1 : null;
  } catch {
    return null;
  }
}

async function checkAppStoreRank(
  term: string,
  appId: string,
  country: string
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=100`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = data.results ?? [];
    const idx = results.findIndex((r) => String(r.trackId) === String(appId));
    return idx >= 0 ? idx + 1 : null;
  } catch {
    return null;
  }
}

// ── Batch process with throttling ────────────────────────────
async function processBatched<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ── Normalize and add candidate ──────────────────────────────
function addCandidate(
  map: Map<string, DiscoveredKeyword["source"]>,
  term: string,
  source: DiscoveredKeyword["source"]
) {
  const normalized = term.toLowerCase().trim();
  if (normalized.length < 3 || STOP_WORDS.has(normalized) || map.has(normalized)) return;
  map.set(normalized, source);
}

// ── Extract keywords from text ───────────────────────────────
function extractWords(text: string, minLen = 3): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= minLen && !STOP_WORDS.has(w));
}

// ── Get autocomplete suggestions (normalized) ────────────────
async function getPlaySuggestions(term: string, country: string): Promise<string[]> {
  try {
    const results = await gplay.suggest({ term, country });
    return results.map((r) =>
      typeof r === "string" ? r : (r as { term?: string }).term ?? String(r)
    );
  } catch {
    return [];
  }
}

async function getAppStoreHints(term: string): Promise<string[]> {
  try {
    const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?media=software&term=${encodeURIComponent(term)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.hints ?? []).map((h: any) => h.term ?? h).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Play Store keyword discovery ─────────────────────────────
async function discoverPlayStoreKeywords(
  appId: string,
  appName: string,
  country: string
): Promise<DiscoveredKeyword[]> {
  const candidateSet = new Map<string, DiscoveredKeyword["source"]>();

  // Get app metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let appData: any = null;
  try {
    appData = await gplay.app({ appId, country });
  } catch { /* continue */ }

  // Extract genre words as seeds
  const genreWords = appData?.genre
    ? extractWords(appData.genre)
    : [];
  for (const w of genreWords) {
    addCandidate(candidateSet, w, "category");
  }

  // Build seed terms: app name words, genre words, and 2-word combos
  const nameWords = extractWords(appName, 2);
  const seedTerms = [...new Set([appName, ...nameWords, ...genreWords])];

  // Add 2-word combinations from app name
  for (let i = 0; i < nameWords.length - 1; i++) {
    seedTerms.push(`${nameWords[i]} ${nameWords[i + 1]}`);
  }

  // ── Phase 1: Gather candidates from multiple sources ──────

  // 1a. Level-1 autocomplete for each seed
  const level1Suggestions: string[] = [];
  await processBatched(seedTerms, 5, async (seed) => {
    const suggestions = await getPlaySuggestions(seed, country);
    for (const s of suggestions) {
      level1Suggestions.push(s);
      // Add full phrase as candidate
      addCandidate(candidateSet, s, "autocomplete");
      // Also add individual words
      for (const w of extractWords(s)) {
        addCandidate(candidateSet, w, "autocomplete");
      }
    }
    return null;
  });

  // 1b. Level-2 recursive autocomplete (expand each level-1 suggestion)
  const uniqueL1 = [...new Set(level1Suggestions)].slice(0, 30);
  await processBatched(uniqueL1, 5, async (term) => {
    const suggestions = await getPlaySuggestions(term, country);
    for (const s of suggestions) {
      addCandidate(candidateSet, s, "autocomplete");
      for (const w of extractWords(s)) {
        addCandidate(candidateSet, w, "autocomplete");
      }
    }
    return null;
  });

  // 2. Competitor titles + summaries from multiple search terms
  const searchSeeds = [appName, ...genreWords.slice(0, 2)].filter(Boolean);
  await processBatched(searchSeeds, 3, async (seed) => {
    try {
      const searchResults = await gplay.search({ term: seed, num: 30, country });
      const competitors = searchResults.filter((r) => r.appId !== appId).slice(0, 15);
      for (const comp of competitors) {
        // Title words
        for (const w of extractWords(comp.title ?? "")) {
          addCandidate(candidateSet, w, "competitor");
        }
        // Full title as phrase
        if (comp.title) addCandidate(candidateSet, comp.title, "competitor");
        // Summary words (short description)
        if ((comp as { summary?: string }).summary) {
          for (const w of extractWords((comp as { summary?: string }).summary!)) {
            addCandidate(candidateSet, w, "competitor");
          }
        }
      }
    } catch { /* skip */ }
    return null;
  });

  // 3. Similar apps
  try {
    const similar = await gplay.similar({ appId, country });
    for (const app of similar.slice(0, 15)) {
      for (const w of extractWords(app.title ?? "")) {
        addCandidate(candidateSet, w, "competitor");
      }
      if (app.title) addCandidate(candidateSet, app.title, "competitor");
    }
  } catch { /* skip */ }

  // 4. Developer's other apps
  if (appData?.developerId) {
    try {
      const devApps = await gplay.developer({ devId: appData.developerId, country });
      for (const app of devApps.slice(0, 10)) {
        for (const w of extractWords(app.title ?? "")) {
          addCandidate(candidateSet, w, "competitor");
        }
      }
    } catch { /* skip */ }
  }

  // 5. Google Search suggestions
  for (const seed of [appName, ...genreWords.slice(0, 2)]) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed + " app")}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const data = await res.json();
      const suggestions: string[] = data[1] ?? [];
      for (const s of suggestions) {
        const cleaned = s.replace(/\s*app\s*$/i, "").trim();
        addCandidate(candidateSet, cleaned, "autocomplete");
      }
    } catch { /* skip */ }
  }

  // ── Phase 2: Check rankings in batches ────────────────────
  const candidates = Array.from(candidateSet.entries())
    .map(([term, source]) => ({ term, source }));

  const discovered: DiscoveredKeyword[] = [];

  const results = await processBatched(candidates, 5, async ({ term, source }) => {
    const rank = await checkPlayStoreRank(term, appId, country);
    if (rank === null) return null;

    const volume = await estimatePlayStoreVolume(term, country);
    return { term, rank, estimatedVolume: volume, source } as DiscoveredKeyword;
  });

  for (const r of results) {
    if (r) discovered.push(r);
  }

  discovered.sort((a, b) => a.rank - b.rank);
  return discovered;
}

// ── App Store keyword discovery ──────────────────────────────
async function discoverAppStoreKeywords(
  appId: string,
  appName: string,
  country: string
): Promise<DiscoveredKeyword[]> {
  const candidateSet = new Map<string, DiscoveredKeyword["source"]>();

  // Get app metadata
  let genre = "";
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${appId}&country=${country}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const app = data.results?.[0];
      if (app?.primaryGenreName) {
        genre = app.primaryGenreName;
        for (const w of extractWords(genre)) {
          addCandidate(candidateSet, w, "category");
        }
      }
    }
  } catch { /* continue */ }

  const nameWords = extractWords(appName, 2);
  const genreWords = extractWords(genre);
  const seedTerms = [...new Set([appName, ...nameWords, ...genreWords])];

  // Add 2-word combinations
  for (let i = 0; i < nameWords.length - 1; i++) {
    seedTerms.push(`${nameWords[i]} ${nameWords[i + 1]}`);
  }

  // 1a. Level-1 autocomplete
  const level1Suggestions: string[] = [];
  await processBatched(seedTerms, 5, async (seed) => {
    const hints = await getAppStoreHints(seed);
    for (const h of hints) {
      level1Suggestions.push(h);
      addCandidate(candidateSet, h, "autocomplete");
      for (const w of extractWords(h)) {
        addCandidate(candidateSet, w, "autocomplete");
      }
    }
    return null;
  });

  // 1b. Level-2 recursive autocomplete
  const uniqueL1 = [...new Set(level1Suggestions)].slice(0, 30);
  await processBatched(uniqueL1, 5, async (term) => {
    const hints = await getAppStoreHints(term);
    for (const h of hints) {
      addCandidate(candidateSet, h, "autocomplete");
      for (const w of extractWords(h)) {
        addCandidate(candidateSet, w, "autocomplete");
      }
    }
    return null;
  });

  // 2. Competitor titles from multiple search terms
  const searchSeeds = [appName, ...genreWords.slice(0, 2)].filter(Boolean);
  await processBatched(searchSeeds, 3, async (seed) => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(seed)}&country=${country}&entity=software&limit=25`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = data.results ?? [];
      const competitors = results.filter((r) => String(r.trackId) !== String(appId)).slice(0, 15);
      for (const comp of competitors) {
        for (const w of extractWords(comp.trackName ?? "")) {
          addCandidate(candidateSet, w, "competitor");
        }
        if (comp.trackName) addCandidate(candidateSet, comp.trackName, "competitor");
        // Description keywords (first 500 chars)
        if (comp.description) {
          const descWords = extractWords(comp.description.slice(0, 500));
          for (const w of descWords) {
            addCandidate(candidateSet, w, "competitor");
          }
        }
      }
    } catch { /* skip */ }
    return null;
  });

  // 3. Google Search suggestions
  for (const seed of [appName, ...genreWords.slice(0, 2)]) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed + " app")}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const data = await res.json();
      const suggestions: string[] = data[1] ?? [];
      for (const s of suggestions) {
        const cleaned = s.replace(/\s*app\s*$/i, "").trim();
        addCandidate(candidateSet, cleaned, "autocomplete");
      }
    } catch { /* skip */ }
  }

  // ── Check rankings ────────────────────────────────────────
  const candidates = Array.from(candidateSet.entries())
    .map(([term, source]) => ({ term, source }));

  const discovered: DiscoveredKeyword[] = [];

  const results = await processBatched(candidates, 5, async ({ term, source }) => {
    const rank = await checkAppStoreRank(term, appId, country);
    if (rank === null) return null;

    const volume = await estimateAppStoreVolume(term, country);
    return { term, rank, estimatedVolume: volume, source } as DiscoveredKeyword;
  });

  for (const r of results) {
    if (r) discovered.push(r);
  }

  discovered.sort((a, b) => a.rank - b.rank);
  return discovered;
}

// ── POST handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appId, store, country, appName } = body as {
      appId: string;
      store: "appstore" | "playstore";
      country: string;
      appName: string;
    };

    if (!appId || !appName) {
      return NextResponse.json(
        { error: "Missing required fields: appId, appName" },
        { status: 400 }
      );
    }

    const effectiveCountry = country === "ALL" ? "US" : country;
    let keywords: DiscoveredKeyword[];

    if (store === "playstore") {
      keywords = await discoverPlayStoreKeywords(appId, appName, effectiveCountry);
    } else {
      keywords = await discoverAppStoreKeywords(appId, appName, effectiveCountry);
    }

    return NextResponse.json({ keywords });
  } catch (err) {
    console.error("[DiscoverKeywords] Error:", err);
    return NextResponse.json(
      { error: "Failed to discover keywords" },
      { status: 500 }
    );
  }
}
