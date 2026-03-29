import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import type { RevenueEstimate } from "@/lib/types";

// ── Category IAP conversion rates ────────────────────────────
const PLAY_STORE_RATES: Record<string, number> = {
  "GAME": 0.035, "GAME_CASUAL": 0.03, "GAME_ACTION": 0.04,
  "GAME_ADVENTURE": 0.04, "GAME_ARCADE": 0.035, "GAME_BOARD": 0.025,
  "GAME_CARD": 0.04, "GAME_CASINO": 0.06, "GAME_EDUCATIONAL": 0.02,
  "GAME_MUSIC": 0.03, "GAME_PUZZLE": 0.035, "GAME_RACING": 0.04,
  "GAME_ROLE_PLAYING": 0.06, "GAME_SIMULATION": 0.045,
  "GAME_SPORTS": 0.04, "GAME_STRATEGY": 0.05, "GAME_TRIVIA": 0.03,
  "GAME_WORD": 0.03, "BUSINESS": 0.08, "PRODUCTIVITY": 0.06,
  "SOCIAL": 0.04, "ENTERTAINMENT": 0.03, "HEALTH_AND_FITNESS": 0.05,
  "LIFESTYLE": 0.04, "EDUCATION": 0.03, "FINANCE": 0.05,
  "COMMUNICATION": 0.03, "DATING": 0.06, "FOOD_AND_DRINK": 0.04,
  "MUSIC_AND_AUDIO": 0.04, "PHOTOGRAPHY": 0.035, "SHOPPING": 0.03,
  "SPORTS": 0.035, "TOOLS": 0.04, "TRAVEL_AND_LOCAL": 0.035,
  "WEATHER": 0.03, "MEDICAL": 0.05, "NEWS_AND_MAGAZINES": 0.025,
};

const APP_STORE_RATES: Record<string, number> = {
  "Games": 0.035, "Business": 0.08, "Productivity": 0.06,
  "Social Networking": 0.04, "Entertainment": 0.03,
  "Health & Fitness": 0.05, "Lifestyle": 0.04, "Education": 0.03,
  "Finance": 0.05, "Music": 0.04, "Photo & Video": 0.035,
  "Shopping": 0.03, "Sports": 0.035, "Utilities": 0.04,
  "Travel": 0.035, "Weather": 0.03, "Food & Drink": 0.04,
  "Medical": 0.05, "News": 0.025, "Dating": 0.06,
};

// ── Retention benchmarks by category ─────────────────────────
const RETENTION_BENCHMARKS: Record<string, { d1: number; d7: number; d30: number }> = {
  "GAME_CASUAL":      { d1: 0.30, d7: 0.10, d30: 0.03 },
  "GAME_ACTION":      { d1: 0.27, d7: 0.11, d30: 0.04 },
  "GAME_ADVENTURE":   { d1: 0.25, d7: 0.10, d30: 0.04 },
  "GAME_ARCADE":      { d1: 0.28, d7: 0.10, d30: 0.03 },
  "GAME_BOARD":       { d1: 0.26, d7: 0.10, d30: 0.04 },
  "GAME_CARD":        { d1: 0.28, d7: 0.12, d30: 0.05 },
  "GAME_CASINO":      { d1: 0.25, d7: 0.12, d30: 0.06 },
  "GAME_EDUCATIONAL": { d1: 0.22, d7: 0.08, d30: 0.03 },
  "GAME_MUSIC":       { d1: 0.26, d7: 0.09, d30: 0.03 },
  "GAME_PUZZLE":      { d1: 0.32, d7: 0.12, d30: 0.04 },
  "GAME_RACING":      { d1: 0.27, d7: 0.10, d30: 0.03 },
  "GAME_ROLE_PLAYING":{ d1: 0.22, d7: 0.10, d30: 0.05 },
  "GAME_SIMULATION":  { d1: 0.24, d7: 0.09, d30: 0.04 },
  "GAME_SPORTS":      { d1: 0.26, d7: 0.10, d30: 0.04 },
  "GAME_STRATEGY":    { d1: 0.25, d7: 0.12, d30: 0.06 },
  "GAME_TRIVIA":      { d1: 0.28, d7: 0.10, d30: 0.03 },
  "GAME_WORD":        { d1: 0.30, d7: 0.11, d30: 0.04 },
  "GAME":             { d1: 0.27, d7: 0.10, d30: 0.04 },
  "SOCIAL":           { d1: 0.35, d7: 0.18, d30: 0.10 },
  "COMMUNICATION":    { d1: 0.33, d7: 0.16, d30: 0.09 },
  "PRODUCTIVITY":     { d1: 0.20, d7: 0.10, d30: 0.06 },
  "BUSINESS":         { d1: 0.18, d7: 0.09, d30: 0.05 },
  "ENTERTAINMENT":    { d1: 0.22, d7: 0.09, d30: 0.04 },
  "HEALTH_AND_FITNESS": { d1: 0.20, d7: 0.10, d30: 0.05 },
  "LIFESTYLE":        { d1: 0.18, d7: 0.08, d30: 0.04 },
  "EDUCATION":        { d1: 0.18, d7: 0.08, d30: 0.04 },
  "FINANCE":          { d1: 0.22, d7: 0.12, d30: 0.07 },
  "DATING":           { d1: 0.30, d7: 0.14, d30: 0.06 },
  "FOOD_AND_DRINK":   { d1: 0.20, d7: 0.10, d30: 0.05 },
  "MUSIC_AND_AUDIO":  { d1: 0.25, d7: 0.12, d30: 0.06 },
  "PHOTOGRAPHY":      { d1: 0.18, d7: 0.08, d30: 0.04 },
  "SHOPPING":         { d1: 0.22, d7: 0.10, d30: 0.05 },
  "SPORTS":           { d1: 0.24, d7: 0.10, d30: 0.04 },
  "TOOLS":            { d1: 0.18, d7: 0.08, d30: 0.04 },
  "TRAVEL_AND_LOCAL": { d1: 0.20, d7: 0.09, d30: 0.04 },
  "WEATHER":          { d1: 0.22, d7: 0.10, d30: 0.05 },
  "MEDICAL":          { d1: 0.20, d7: 0.10, d30: 0.06 },
  "NEWS_AND_MAGAZINES": { d1: 0.25, d7: 0.12, d30: 0.06 },
  // App Store categories (mapped to same benchmarks)
  "Games":            { d1: 0.27, d7: 0.10, d30: 0.04 },
  "Social Networking":{ d1: 0.35, d7: 0.18, d30: 0.10 },
  "Productivity":     { d1: 0.20, d7: 0.10, d30: 0.06 },
  "Business":         { d1: 0.18, d7: 0.09, d30: 0.05 },
  "Entertainment":    { d1: 0.22, d7: 0.09, d30: 0.04 },
  "Health & Fitness": { d1: 0.20, d7: 0.10, d30: 0.05 },
  "Lifestyle":        { d1: 0.18, d7: 0.08, d30: 0.04 },
  "Education":        { d1: 0.18, d7: 0.08, d30: 0.04 },
  "Finance":          { d1: 0.22, d7: 0.12, d30: 0.07 },
  "Music":            { d1: 0.25, d7: 0.12, d30: 0.06 },
  "Photo & Video":    { d1: 0.18, d7: 0.08, d30: 0.04 },
  "Shopping":         { d1: 0.22, d7: 0.10, d30: 0.05 },
  "Sports":           { d1: 0.24, d7: 0.10, d30: 0.04 },
  "Utilities":        { d1: 0.18, d7: 0.08, d30: 0.04 },
  "Travel":           { d1: 0.20, d7: 0.09, d30: 0.04 },
  "Weather":          { d1: 0.22, d7: 0.10, d30: 0.05 },
  "Food & Drink":     { d1: 0.20, d7: 0.10, d30: 0.05 },
  "Medical":          { d1: 0.20, d7: 0.10, d30: 0.06 },
  "News":             { d1: 0.25, d7: 0.12, d30: 0.06 },
  "Dating":           { d1: 0.30, d7: 0.14, d30: 0.06 },
};

const DEFAULT_RETENTION = { d1: 0.25, d7: 0.10, d30: 0.04 };
const DEFAULT_RATE = 0.03;

// ── Industry-standard IAP price weighting ────────────────────
// 60-70% revenue from bottom 20% IAP prices (high volume, cheap)
// 10-20% from mid-price IAPs
// 10-20% from top-price IAPs (whales)
function calculateWeightedIapPrice(min: number, max: number): number {
  const bottomPrice = min + (max - min) * 0.10;  // 10th percentile
  const midPrice = min + (max - min) * 0.40;     // 40th percentile
  const topPrice = min + (max - min) * 0.80;     // 80th percentile

  // Weighted by revenue contribution
  return bottomPrice * 0.65 + midPrice * 0.15 + topPrice * 0.20;
}

// ── Parse IAP price range from Google Play ──────────────────
function parseIAPRange(range: string | undefined): { min: number; max: number; weighted: number } | null {
  if (!range) return null;
  const matches = range.match(/[\d.]+/g);
  if (!matches || matches.length < 2) {
    if (matches?.length === 1) {
      const price = parseFloat(matches[0]);
      return { min: price, max: price, weighted: price };
    }
    return null;
  }
  const min = parseFloat(matches[0]);
  const max = parseFloat(matches[matches.length - 1]);
  return { min, max, weighted: calculateWeightedIapPrice(min, max) };
}

// ── Estimate retention with quality adjustments ──────────────
function estimateRetention(
  category: string,
  rating: number,
  ratingCount: number
): { d1: number; d7: number; d30: number } {
  const base = RETENTION_BENCHMARKS[category] ?? DEFAULT_RETENTION;

  // Rating adjustment: higher rating = better retention
  let ratingMultiplier = 1.0;
  if (rating >= 4.5) ratingMultiplier = 1.15;
  else if (rating >= 4.2) ratingMultiplier = 1.05;
  else if (rating >= 4.0) ratingMultiplier = 1.0;
  else if (rating >= 3.5) ratingMultiplier = 0.85;
  else if (rating > 0) ratingMultiplier = 0.70;

  // High rating count = more established, slightly better retention
  let engagementBoost = 1.0;
  if (ratingCount >= 1_000_000) engagementBoost = 1.10;
  else if (ratingCount >= 100_000) engagementBoost = 1.05;
  else if (ratingCount < 1_000) engagementBoost = 0.95;

  const multiplier = ratingMultiplier * engagementBoost;

  return {
    d1: Math.min(0.60, Math.round(base.d1 * multiplier * 100) / 100),
    d7: Math.min(0.35, Math.round(base.d7 * multiplier * 100) / 100),
    d30: Math.min(0.20, Math.round(base.d30 * multiplier * 100) / 100),
  };
}

// ── Determine confidence level ───────────────────────────────
function getConfidence(
  hasInstalls: boolean,
  hasIAPRange: boolean,
  hasRatings: boolean,
): RevenueEstimate["confidence"] {
  const signals = [hasInstalls, hasIAPRange, hasRatings].filter(Boolean).length;
  if (signals >= 3) return "high";
  if (signals >= 2) return "medium";
  return "low";
}

// ── Check if category is a game ──────────────────────────────
function isGameCategory(category: string): boolean {
  const lower = category.toLowerCase();
  return lower.startsWith("game") || lower === "games";
}

// ── Play Store revenue estimation ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function estimatePlayStoreRevenue(app: any): RevenueEstimate {
  const minInstalls = app.minInstalls ?? 0;
  const maxInstalls = app.maxInstalls ?? minInstalls * 2;
  const offersIAP = app.offersIAP ?? false;
  const iapRange = app.IAPRange;
  const genreId = app.genreId ?? app.genre ?? "";
  const category = typeof genreId === "string" ? genreId : "";
  const rating = app.score ?? 0;
  const ratingCount = app.ratings ?? 0;
  const isFree = app.free !== false;
  const isGame = isGameCategory(category);

  const conversionRate = PLAY_STORE_RATES[category] ?? DEFAULT_RATE;
  const iapPrices = parseIAPRange(iapRange);
  const retention = estimateRetention(category, rating, ratingCount);

  // No IAP = no IAP revenue
  if (!offersIAP) {
    const hasAds = isFree; // Free app without IAP probably has ads
    return {
      monthlyRevenue: { low: 0, mid: 0, high: 0 },
      dailyRevenue: { low: 0, mid: 0, high: 0 },
      confidence: "high",
      retention,
      breakdown: {
        estimatedDownloads: { min: minInstalls, max: maxInstalls },
        iapPriceRange: null,
        avgIapPrice: 0,
        conversionRate: 0,
        category: app.genre ?? category,
        hasAds,
        iapRevenueShare: hasAds ? 0 : 0,
        adRevenueShare: hasAds ? 1 : 0,
      },
    };
  }

  // Use industry-weighted IAP price
  const avgIapPrice = iapPrices?.weighted ?? (isGame ? 4.99 : 6.99);

  // Geometric mean of install brackets for a more stable estimate
  const installEstimate = minInstalls > 0 && maxInstalls > 0
    ? Math.sqrt(minInstalls * maxInstalls)
    : (minInstalls + maxInstalls) / 2;

  // MAU = 25% of total installs
  const mau = installEstimate * 0.25;

  // IAP revenue = MAU × conversion rate × avg IAP price × 0.7 (store cut)
  const iapRevenue = Math.round(mau * conversionRate * avgIapPrice * 0.7);

  // Games with ads: IAP = 70% of total, Ads = 30%
  const hasAds = isGame && isFree;
  const totalRevenue = hasAds ? Math.round(iapRevenue / 0.7) : iapRevenue;

  // Tight range: ±30%
  const monthlyMid = totalRevenue;
  const monthlyLow = Math.round(monthlyMid * 0.7);
  const monthlyHigh = Math.round(monthlyMid * 1.3);

  return {
    monthlyRevenue: { low: monthlyLow, mid: monthlyMid, high: monthlyHigh },
    dailyRevenue: {
      low: Math.round(monthlyLow / 30),
      mid: Math.round(monthlyMid / 30),
      high: Math.round(monthlyHigh / 30),
    },
    confidence: getConfidence(minInstalls > 0, !!iapPrices, ratingCount > 0),
    retention,
    breakdown: {
      estimatedDownloads: { min: minInstalls, max: maxInstalls },
      iapPriceRange: iapRange ?? null,
      avgIapPrice,
      conversionRate,
      category: app.genre ?? category,
      hasAds,
      iapRevenueShare: hasAds ? 0.7 : 1,
      adRevenueShare: hasAds ? 0.3 : 0,
    },
  };
}

// ── App Store revenue estimation ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function estimateAppStoreRevenue(app: any): RevenueEstimate {
  const ratingCount = app.userRatingCount ?? 0;
  const category = app.primaryGenreName ?? "";
  const price = app.price ?? 0;
  const rating = app.averageUserRating ?? 0;
  const isFree = price === 0;
  const isGame = isGameCategory(category);

  const conversionRate = APP_STORE_RATES[category] ?? DEFAULT_RATE;
  const retention = estimateRetention(category, rating, ratingCount);

  // Estimate downloads from ratings (tighter ratio: 50-70x)
  const downloadEstimate = ratingCount * 60; // geometric mean of 50-70
  const downloads = {
    min: ratingCount * 50,
    max: ratingCount * 70,
  };

  // Paid app — revenue from purchases
  if (!isFree && price > 0) {
    const monthlyDownloads = downloadEstimate / 12;
    const monthlyMid = Math.round(monthlyDownloads * price * 0.7);
    const monthlyLow = Math.round(monthlyMid * 0.7);
    const monthlyHigh = Math.round(monthlyMid * 1.3);

    return {
      monthlyRevenue: { low: monthlyLow, mid: monthlyMid, high: monthlyHigh },
      dailyRevenue: {
        low: Math.round(monthlyLow / 30),
        mid: Math.round(monthlyMid / 30),
        high: Math.round(monthlyHigh / 30),
      },
      confidence: ratingCount > 1000 ? "medium" : "low",
      retention,
      breakdown: {
        estimatedDownloads: downloads,
        iapPriceRange: `Paid: ${app.formattedPrice ?? "$" + price}`,
        avgIapPrice: price,
        conversionRate: 1,
        category,
        hasAds: false,
        iapRevenueShare: 1,
        adRevenueShare: 0,
      },
    };
  }

  // Free app with IAP — no IAP range from iOS, use category averages
  const avgIapPrice = isGame ? 4.99 : 6.99;

  // MAU
  const mau = downloadEstimate * 0.25;

  // IAP revenue
  const iapRevenue = Math.round(mau * conversionRate * avgIapPrice * 0.7);

  // Games with ads: IAP = 70%, Ads = 30%
  const hasAds = isGame && isFree;
  const totalRevenue = hasAds ? Math.round(iapRevenue / 0.7) : iapRevenue;

  const monthlyMid = totalRevenue;
  const monthlyLow = Math.round(monthlyMid * 0.7);
  const monthlyHigh = Math.round(monthlyMid * 1.3);

  return {
    monthlyRevenue: { low: monthlyLow, mid: monthlyMid, high: monthlyHigh },
    dailyRevenue: {
      low: Math.round(monthlyLow / 30),
      mid: Math.round(monthlyMid / 30),
      high: Math.round(monthlyHigh / 30),
    },
    confidence: getConfidence(ratingCount > 0, false, ratingCount > 100),
    retention,
    breakdown: {
      estimatedDownloads: downloads,
      iapPriceRange: null,
      avgIapPrice,
      conversionRate,
      category,
      hasAds,
      iapRevenueShare: hasAds ? 0.7 : 1,
      adRevenueShare: hasAds ? 0.3 : 0,
    },
  };
}

// ── POST handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appId, store, country } = body as {
      appId: string;
      store: "appstore" | "playstore";
      country: string;
    };

    if (!appId) {
      return NextResponse.json({ error: "Missing required field: appId" }, { status: 400 });
    }

    const effectiveCountry = country === "ALL" ? "US" : country;
    let estimate: RevenueEstimate;

    if (store === "playstore") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app: any = await gplay.app({ appId, country: effectiveCountry });
      estimate = estimatePlayStoreRevenue(app);
    } else {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${appId}&country=${effectiveCountry}`
      );
      if (!res.ok) {
        return NextResponse.json({ error: `iTunes API returned ${res.status}` }, { status: 502 });
      }
      const data = await res.json();
      const app = data.results?.[0];
      if (!app) {
        return NextResponse.json({ error: "App not found" }, { status: 404 });
      }
      estimate = estimateAppStoreRevenue(app);
    }

    return NextResponse.json(estimate);
  } catch (err) {
    console.error("[RevenueEstimate] Error:", err);
    return NextResponse.json(
      { error: "Failed to estimate revenue" },
      { status: 500 }
    );
  }
}
