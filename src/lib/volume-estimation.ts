import gplay from "google-play-scraper";

// ── Play Store volume signals ────────────────────────────────

/** Autocomplete with exact-match detection + stricter matching (0-35) */
export function playAutocompleteSignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase().trim();
  if (suggestions.length === 0) return 0;

  let bestScore = 0;
  for (let i = 0; i < suggestions.length; i++) {
    const sug = suggestions[i].toLowerCase().trim();
    const isExact = sug === lower;
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
export function playDensitySignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase();
  const matches = suggestions.filter(s => s.toLowerCase().includes(lower)).length;
  return Math.min(15, matches * 3);
}

/** Competition intensity: how many top-10 results have the keyword in their title (0-25) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function competitionIntensitySignal(term: string, results: any[]): number {
  const lower = term.toLowerCase();
  const top10 = results.slice(0, 10);
  const titleMatches = top10.filter((r: { title?: string }) => {
    const title = (r.title ?? "").toLowerCase();
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
export function playInstallSignal(results: any[]): number {
  if (results.length === 0) return 0;
  const top5 = results.slice(0, 5);
  const avgInstalls =
    top5.reduce((sum: number, r: { minInstalls?: number }) => sum + (r.minInstalls ?? 0), 0) / top5.length;
  if (avgInstalls <= 0) return 0;
  return Math.min(15, Math.round(Math.log10(avgInstalls) * 1.5));
}

/** Google Search autocomplete cross-reference (0-10) */
export async function googleSearchAutocompleteSignal(term: string): Promise<number> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(term + " app")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return 0;
    const data = await res.json();
    const suggestions: string[] = data[1] ?? [];
    const lower = term.toLowerCase();

    const hasAppSuggestion = suggestions.some(s => {
      const sl = s.toLowerCase();
      return sl.includes(lower) && (sl.includes("app") || sl.includes("game"));
    });
    if (hasAppSuggestion) return 10;

    const hasKeyword = suggestions.some(s => s.toLowerCase().includes(lower));
    if (hasKeyword) return 5;

    return 0;
  } catch {
    return 0;
  }
}

// ── App Store volume signals ─────────────────────────────────

/** Result count scaled to 0-30 range */
export function resultCountSignal(count: number): number {
  if (count >= 50) return 30;
  if (count >= 40) return 25;
  if (count >= 30) return 20;
  if (count >= 20) return 15;
  if (count >= 10) return 10;
  if (count >= 5) return 7;
  if (count >= 1) return Math.max(3, Math.round(count * 1.5));
  return 0;
}

/** Autocomplete position score (0-30) */
export function autocompletePositionSignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase();
  const idx = suggestions.findIndex(
    s => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase())
  );
  if (idx === -1) return 0;
  const scores = [30, 25, 20, 15, 10];
  return scores[idx] ?? 5;
}

/** Keyword density (0-20) */
export function keywordDensitySignal(term: string, suggestions: string[]): number {
  const lower = term.toLowerCase();
  const matches = suggestions.filter(s => s.toLowerCase().includes(lower)).length;
  return Math.min(20, matches * 4);
}

/** Top-app rating count signal for App Store (0-20). Proxy for installs */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function topAppRatingSignal(results: any[]): number {
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

// ── Fetch App Store autocomplete hints ───────────────────────

export async function fetchAppStoreHints(term: string): Promise<string[]> {
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

// ── Combined volume estimation functions ─────────────────────

export async function estimatePlayStoreVolume(term: string, country: string): Promise<number> {
  try {
    const [results, suggestions, googleScore] = await Promise.all([
      gplay.search({ term, num: 50, country }),
      gplay.suggest({ term, country }).catch(() => [] as string[]),
      googleSearchAutocompleteSignal(term),
    ]);

    const suggestArr = (suggestions as (string | { term?: string })[]).map(s =>
      typeof s === "string" ? s : (s as { term?: string }).term ?? String(s)
    );

    const autocomplete = playAutocompleteSignal(term, suggestArr);  // 0-35
    const density = playDensitySignal(term, suggestArr);             // 0-15
    const competition = competitionIntensitySignal(term, results);   // 0-25
    const installs = playInstallSignal(results);                     // 0-15
    // googleScore                                                    // 0-10

    return Math.min(100, autocomplete + density + competition + installs + googleScore);
  } catch {
    return 0;
  }
}

export async function estimateAppStoreVolume(term: string, country: string): Promise<number> {
  try {
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

/** Difficulty estimation based on title keyword competition */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function estimateDifficulty(term: string, topResults: any[]): "low" | "medium" | "high" {
  const lower = term.toLowerCase();
  const top10 = topResults.slice(0, 10);
  const titleMatches = top10.filter((r) => {
    const title = (r.title ?? r.trackName ?? "").toLowerCase();
    return title.includes(lower);
  }).length;

  if (titleMatches >= 6) return "high";
  if (titleMatches >= 3) return "medium";
  return "low";
}
