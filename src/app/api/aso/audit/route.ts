import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import type { AsoAuditFactor, AsoAuditResult } from "@/lib/types";

// ── Scoring helpers ────────────────────────────────────────

function scoreFactor(name: string, score: number, maxScore: number, tips: string[]): AsoAuditFactor {
  return { name, score: Math.round(Math.min(maxScore, Math.max(0, score))), maxScore, tips };
}

function hasKeywordsBeyondBrand(title: string, developer: string): boolean {
  const devWords = developer.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  // Check if title has words that aren't part of the developer/brand name
  const nonBrandWords = titleWords.filter((w) => !devWords.some((d) => d.includes(w) || w.includes(d)));
  return nonBrandWords.length > 0;
}

function hasStructure(text: string): boolean {
  // Check for line breaks, bullet points, emoji headers, or other formatting
  return /[\n\r]/.test(text) || /[•●◆★✓✔►▶\-–—]/.test(text) || /\p{Emoji}/u.test(text);
}

function wordsOverlap(a: string, b: string): boolean {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length >= 3));
  return wordsA.some((w) => wordsB.has(w));
}

// ── Play Store audit ───────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function auditPlayStore(app: any): AsoAuditResult {
  const factors: AsoAuditFactor[] = [];
  const title = app.title ?? "";
  const summary = app.summary ?? "";
  const description = app.description ?? "";
  const developer = app.developer ?? "";
  const genre = app.genre ?? app.genreId ?? "";
  const icon = app.icon ?? "";
  const screenshots: string[] = app.screenshots ?? [];
  const video = app.video ?? "";
  const headerImage = app.headerImage ?? "";

  // Title (30 char max for GP)
  {
    const tips: string[] = [];
    let score = 0;
    const lengthRatio = Math.min(1, title.length / 30);
    score += lengthRatio * 40;
    if (hasKeywordsBeyondBrand(title, developer)) {
      score += 30;
    } else {
      tips.push("Add relevant keywords beyond your brand name to the title.");
    }
    if (title.length > 15) {
      score += 30;
    } else {
      tips.push("Use more of the available 30 characters to include descriptive keywords.");
    }
    if (title.length > 30) {
      tips.push("Title exceeds 30 characters — Google Play may truncate it.");
    }
    factors.push(scoreFactor("Title", score, 100, tips));
  }

  // Short Description (80 char max for GP)
  {
    const tips: string[] = [];
    let score = 0;
    const lengthRatio = Math.min(1, summary.length / 80);
    score += lengthRatio * 50;
    if (summary.length > 40) {
      score += 25;
    } else if (summary.length > 0) {
      tips.push("Short description is too brief. Aim for 60-80 characters with keywords.");
    } else {
      tips.push("Add a short description to improve discoverability.");
    }
    if (!wordsOverlap(summary, title)) {
      score += 25;
    } else {
      tips.push("Avoid repeating title words in the short description — use new keywords instead.");
    }
    factors.push(scoreFactor("Short Description", score, 100, tips));
  }

  // Long Description (4000 char max)
  {
    const tips: string[] = [];
    let score = 0;
    if (description.length > 2000) {
      score += 40;
    } else if (description.length > 1000) {
      score += 25;
      tips.push("Expand your description to 2000+ characters for better keyword coverage.");
    } else {
      score += 10;
      tips.push("Description is very short. Aim for 2000-4000 characters with relevant keywords.");
    }
    if (hasStructure(description)) {
      score += 30;
    } else {
      tips.push("Add formatting (bullet points, line breaks) to improve readability.");
    }
    // Reasonable keyword density: description has at least some of the title words
    const titleWords = title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const descLower = description.toLowerCase();
    const matchCount = titleWords.filter((w: string) => descLower.includes(w)).length;
    if (titleWords.length > 0 && matchCount / titleWords.length >= 0.5) {
      score += 30;
    } else {
      tips.push("Include your main keywords naturally throughout the description.");
    }
    factors.push(scoreFactor("Long Description", score, 100, tips));
  }

  // Developer Name
  {
    const tips: string[] = [];
    let score = 0;
    if (developer.length > 0) {
      score += 50;
    } else {
      tips.push("Developer name is missing.");
    }
    if (developer.length > 5) {
      score += 50;
    } else if (developer.length > 0) {
      tips.push("Consider using a more descriptive developer name.");
    }
    factors.push(scoreFactor("Developer Name", score, 100, tips));
  }

  // Category
  {
    const tips: string[] = [];
    const score = genre ? 100 : 0;
    if (!genre) tips.push("Ensure your app has a category set in the Play Console.");
    factors.push(scoreFactor("Category", score, 100, tips));
  }

  // Icon
  {
    const tips: string[] = [];
    const score = icon ? 100 : 0;
    if (!icon) tips.push("Upload a high-quality app icon.");
    factors.push(scoreFactor("Icon", score, 100, tips));
  }

  // Screenshots (max 8 for GP)
  {
    const tips: string[] = [];
    const count = screenshots.length;
    const score = Math.min(100, Math.round((count / 8) * 100));
    if (count < 8) {
      tips.push(`Only ${count} of 8 screenshot slots used. Add more screenshots showcasing key features.`);
    }
    if (count < 4) {
      tips.push("Having fewer than 4 screenshots significantly hurts conversion rates.");
    }
    factors.push(scoreFactor("Screenshots", score, 100, tips));
  }

  // Video
  {
    const tips: string[] = [];
    const score = video ? 100 : 0;
    if (!video) tips.push("Add a promo video to increase engagement and conversion.");
    factors.push(scoreFactor("Video", score, 100, tips));
  }

  // Feature Graphic (headerImage)
  {
    const tips: string[] = [];
    const score = headerImage ? 100 : 0;
    if (!headerImage) tips.push("Add a feature graphic (header image) for better store presence.");
    factors.push(scoreFactor("Feature Graphic", score, 100, tips));
  }

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score, 0) / factors.length
  );

  // Only include tips for factors scoring below 70
  for (const factor of factors) {
    if (factor.score >= 70) {
      factor.tips = [];
    }
  }

  return { overallScore, factors };
}

// ── App Store audit ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function auditAppStore(app: any): AsoAuditResult {
  const factors: AsoAuditFactor[] = [];
  const title = app.trackName ?? "";
  const description = app.description ?? "";
  const developer = app.artistName ?? "";
  const genre = app.primaryGenreName ?? "";
  const icon = app.artworkUrl512 ?? app.artworkUrl100 ?? "";
  const screenshots: string[] = app.screenshotUrls ?? [];
  // iTunes API does not reliably provide subtitle or video

  // Title (30 char max for App Store)
  {
    const tips: string[] = [];
    let score = 0;
    const lengthRatio = Math.min(1, title.length / 30);
    score += lengthRatio * 40;
    if (hasKeywordsBeyondBrand(title, developer)) {
      score += 30;
    } else {
      tips.push("Add relevant keywords beyond your brand name to the title.");
    }
    if (title.length > 15) {
      score += 30;
    } else {
      tips.push("Use more of the available 30 characters to include descriptive keywords.");
    }
    if (title.length > 30) {
      tips.push("Title exceeds 30 characters — the App Store may truncate it.");
    }
    factors.push(scoreFactor("Title", score, 100, tips));
  }

  // Subtitle (not available from iTunes API — score as N/A)
  {
    factors.push(scoreFactor("Subtitle", 0, 100, [
      "Subtitle data is not available via the iTunes API. Ensure you have a keyword-rich subtitle set in App Store Connect.",
    ]));
  }

  // Long Description
  {
    const tips: string[] = [];
    let score = 0;
    if (description.length > 2000) {
      score += 40;
    } else if (description.length > 1000) {
      score += 25;
      tips.push("Expand your description to 2000+ characters.");
    } else {
      score += 10;
      tips.push("Description is very short. A thorough description improves trust and conversion.");
    }
    if (hasStructure(description)) {
      score += 30;
    } else {
      tips.push("Add formatting (bullet points, line breaks) to improve readability.");
    }
    const titleWords = title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const descLower = description.toLowerCase();
    const matchCount = titleWords.filter((w: string) => descLower.includes(w)).length;
    if (titleWords.length > 0 && matchCount / titleWords.length >= 0.5) {
      score += 30;
    } else {
      tips.push("Include your main keywords naturally throughout the description.");
    }
    factors.push(scoreFactor("Long Description", score, 100, tips));
  }

  // Developer Name
  {
    const tips: string[] = [];
    let score = 0;
    if (developer.length > 0) score += 50;
    else tips.push("Developer name is missing.");
    if (developer.length > 5) score += 50;
    else if (developer.length > 0) tips.push("Consider using a more descriptive developer name.");
    factors.push(scoreFactor("Developer Name", score, 100, tips));
  }

  // Category
  {
    const tips: string[] = [];
    const score = genre ? 100 : 0;
    if (!genre) tips.push("Ensure your app has a primary category set.");
    factors.push(scoreFactor("Category", score, 100, tips));
  }

  // Icon
  {
    const tips: string[] = [];
    const score = icon ? 100 : 0;
    if (!icon) tips.push("Upload a high-quality app icon.");
    factors.push(scoreFactor("Icon", score, 100, tips));
  }

  // Screenshots (max 10 for App Store)
  {
    const tips: string[] = [];
    const count = screenshots.length;
    const score = Math.min(100, Math.round((count / 10) * 100));
    if (count < 10) {
      tips.push(`Only ${count} of 10 screenshot slots used. Add more screenshots showcasing key features.`);
    }
    if (count < 4) {
      tips.push("Having fewer than 4 screenshots significantly hurts conversion rates.");
    }
    factors.push(scoreFactor("Screenshots", score, 100, tips));
  }

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score, 0) / factors.length
  );

  // Only include tips for factors scoring below 70
  for (const factor of factors) {
    if (factor.score >= 70) {
      factor.tips = [];
    }
  }

  return { overallScore, factors };
}

// ── POST handler ───────────────────────────────────────────
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

    let result: AsoAuditResult;

    if (store === "playstore") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app: any = await gplay.app({ appId, country: effectiveCountry });
      result = auditPlayStore(app);
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
      result = auditAppStore(app);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[AsoAudit] Error:", err);
    return NextResponse.json(
      { error: "Failed to audit store listing" },
      { status: 500 }
    );
  }
}
