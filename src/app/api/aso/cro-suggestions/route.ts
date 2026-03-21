import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import type { CroSuggestion } from "@/lib/types";

// ── Play Store CRO analysis ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzePlayStore(app: any): CroSuggestion[] {
  const suggestions: CroSuggestion[] = [];
  const title = app.title ?? "";
  const summary = app.summary ?? "";
  const description = app.description ?? "";
  const icon = app.icon ?? "";
  const screenshots: string[] = app.screenshots ?? [];
  const video = app.video ?? "";
  const headerImage = app.headerImage ?? "";
  const score: number | undefined = app.score;
  const ratings: number | undefined = app.ratings;
  const developer = app.developer ?? "";

  // Icon
  if (!icon) {
    suggestions.push({
      element: "Icon",
      priority: "high",
      currentState: "No icon detected",
      recommendation: "Upload a high-quality, distinctive app icon. The icon is the first visual element users see and directly impacts tap-through rates.",
    });
  }

  // Screenshots
  const screenshotMax = 8;
  if (screenshots.length < 4) {
    suggestions.push({
      element: "Screenshots",
      priority: "high",
      currentState: `${screenshots.length} of ${screenshotMax} used`,
      recommendation: "Add more screenshots showcasing key features. The first 3 screenshots are the most impactful for conversion. Aim for at least 4-6 high-quality screenshots.",
    });
  } else if (screenshots.length < screenshotMax) {
    suggestions.push({
      element: "Screenshots",
      priority: "medium",
      currentState: `${screenshots.length} of ${screenshotMax} used`,
      recommendation: `Fill all ${screenshotMax} screenshot slots. Each additional screenshot is an opportunity to showcase features and convince users to install.`,
    });
  }

  // Video
  if (!video) {
    suggestions.push({
      element: "Video",
      priority: "medium",
      currentState: "No promo video",
      recommendation: "Add a short promo video (30-60 seconds) demonstrating your app in action. Videos significantly increase conversion rates on Google Play.",
    });
  }

  // Rating
  if (score !== undefined) {
    if (score < 4.0) {
      suggestions.push({
        element: "Rating",
        priority: "high",
        currentState: `${score.toFixed(1)} stars`,
        recommendation: "Your rating is below 4.0, which significantly impacts conversion. Focus on fixing top user complaints and consider an in-app review prompt for satisfied users.",
      });
    } else if (score < 4.5) {
      suggestions.push({
        element: "Rating",
        priority: "medium",
        currentState: `${score.toFixed(1)} stars`,
        recommendation: "Improve your rating above 4.5 to maximize conversion. Address recent negative reviews and optimize the in-app review prompt timing.",
      });
    }
  }

  // Rating volume
  if (ratings !== undefined && ratings < 100) {
    suggestions.push({
      element: "Rating Volume",
      priority: "medium",
      currentState: `${ratings} ratings`,
      recommendation: "Low rating count reduces social proof. Implement a strategic in-app review prompt to increase the number of ratings.",
    });
  }

  // Description length
  if (description.length < 500) {
    suggestions.push({
      element: "Description",
      priority: "medium",
      currentState: `${description.length} characters`,
      recommendation: "Your description is too short. Expand it to at least 1000-2000 characters with clear feature highlights, social proof, and a call to action.",
    });
  }

  // Feature Graphic (headerImage)
  if (!headerImage) {
    if (video) {
      suggestions.push({
        element: "Feature Graphic",
        priority: "medium",
        currentState: "No feature graphic",
        recommendation: "Add a feature graphic (header image). Since you have a video, the feature graphic serves as the video thumbnail and is crucial for engagement.",
      });
    } else {
      suggestions.push({
        element: "Feature Graphic",
        priority: "low",
        currentState: "No feature graphic",
        recommendation: "Consider adding a feature graphic for better store presence, especially if you plan to add a promo video.",
      });
    }
  }

  // Title keywords
  {
    const titleWords = title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const devWords = developer.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const nonBrandWords = titleWords.filter(
      (w: string) => !devWords.some((d: string) => d.includes(w) || w.includes(d))
    );
    if (nonBrandWords.length === 0 && titleWords.length > 0) {
      suggestions.push({
        element: "Title Keywords",
        priority: "medium",
        currentState: "Title contains only brand name",
        recommendation: "Add relevant keywords to your title beyond the brand name. Keywords in the title are heavily weighted by the Play Store algorithm.",
      });
    }
  }

  // Short description
  if (summary.length < 40) {
    suggestions.push({
      element: "Short Description",
      priority: "low",
      currentState: summary.length > 0 ? `${summary.length} of 80 characters used` : "Empty",
      recommendation: "Expand your short description to 60-80 characters with compelling keywords. This text appears in search results and impacts both ranking and conversion.",
    });
  }

  return sortByPriority(suggestions);
}

// ── App Store CRO analysis ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeAppStore(app: any): CroSuggestion[] {
  const suggestions: CroSuggestion[] = [];
  const title = app.trackName ?? "";
  const description = app.description ?? "";
  const icon = app.artworkUrl512 ?? app.artworkUrl100 ?? "";
  const screenshots: string[] = app.screenshotUrls ?? [];
  const score: number | undefined = app.averageUserRating;
  const ratingCount: number | undefined = app.userRatingCount;
  const developer = app.artistName ?? "";

  const screenshotMax = 10;

  // Icon
  if (!icon) {
    suggestions.push({
      element: "Icon",
      priority: "high",
      currentState: "No icon detected",
      recommendation: "Upload a high-quality, distinctive app icon. The icon is the first visual element users see in search results and directly impacts tap-through rates.",
    });
  }

  // Screenshots
  if (screenshots.length < 4) {
    suggestions.push({
      element: "Screenshots",
      priority: "high",
      currentState: `${screenshots.length} of ${screenshotMax} used`,
      recommendation: "Add more screenshots showcasing key features. The first 3 screenshots appear in search results and are critical for conversion. Aim for at least 6 screenshots.",
    });
  } else if (screenshots.length < screenshotMax) {
    suggestions.push({
      element: "Screenshots",
      priority: "medium",
      currentState: `${screenshots.length} of ${screenshotMax} used`,
      recommendation: `Fill all ${screenshotMax} screenshot slots. Consider using landscape screenshots for the first position to take more visual space in search results.`,
    });
  }

  // Video (App Preview — not available from iTunes API, but suggest adding one)
  // Since we can't detect it via iTunes API, always suggest it as medium priority
  suggestions.push({
    element: "App Preview Video",
    priority: "medium",
    currentState: "Cannot detect via iTunes API",
    recommendation: "Ensure you have an App Preview video in App Store Connect. Videos auto-play in search results and can significantly boost conversion rates.",
  });

  // Rating
  if (score !== undefined) {
    if (score < 4.0) {
      suggestions.push({
        element: "Rating",
        priority: "high",
        currentState: `${score.toFixed(1)} stars`,
        recommendation: "Your rating is below 4.0, which significantly hurts conversion. Address top user complaints, fix critical bugs, and implement SKStoreReviewController for review prompts.",
      });
    } else if (score < 4.5) {
      suggestions.push({
        element: "Rating",
        priority: "medium",
        currentState: `${score.toFixed(1)} stars`,
        recommendation: "Push your rating above 4.5 for maximum conversion. Respond to negative reviews and optimize your SKStoreReviewController prompt timing.",
      });
    }
  }

  // Rating volume
  if (ratingCount !== undefined && ratingCount < 100) {
    suggestions.push({
      element: "Rating Volume",
      priority: "medium",
      currentState: `${ratingCount} ratings`,
      recommendation: "Low rating count reduces social proof. Use SKStoreReviewController strategically after positive user experiences to increase review volume.",
    });
  }

  // Description length
  if (description.length < 500) {
    suggestions.push({
      element: "Description",
      priority: "medium",
      currentState: `${description.length} characters`,
      recommendation: "Your description is too short. While iOS description doesn't directly affect keyword ranking, it impacts conversion. Add feature highlights, social proof, and a clear value proposition.",
    });
  }

  // Title keywords
  {
    const titleWords = title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const devWords = developer.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3);
    const nonBrandWords = titleWords.filter(
      (w: string) => !devWords.some((d: string) => d.includes(w) || w.includes(d))
    );
    if (nonBrandWords.length === 0 && titleWords.length > 0) {
      suggestions.push({
        element: "Title Keywords",
        priority: "medium",
        currentState: "Title contains only brand name",
        recommendation: "Add relevant keywords to your title. The title is the strongest ranking factor in the App Store. Use the full 30 characters with your brand + top keyword.",
      });
    }
  }

  return sortByPriority(suggestions);
}

// ── Priority sorting ───────────────────────────────────────
function sortByPriority(suggestions: CroSuggestion[]): CroSuggestion[] {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return suggestions.sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));
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

    let suggestions: CroSuggestion[];

    if (store === "playstore") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app: any = await gplay.app({ appId, country: effectiveCountry });
      suggestions = analyzePlayStore(app);
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
      suggestions = analyzeAppStore(app);
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[CroSuggestions] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate CRO suggestions" },
      { status: 500 }
    );
  }
}
