import { NextRequest, NextResponse } from "next/server";
import gplay from "google-play-scraper";
import { createPage } from "@/lib/scrapers/browser";

interface AppEvent {
  name: string;
  description?: string;
  imageUrl?: string;
  badge?: string;
}

interface StoreListingData {
  title: string;
  subtitle?: string;
  description: string;
  screenshots: string[];
  video?: string;
  icon: string;
  developer: string;
  rating?: number;
  installs?: string;
  events?: AppEvent[];
}

export async function GET(req: NextRequest) {
  const appId = req.nextUrl.searchParams.get("appId") || "";
  const store = req.nextUrl.searchParams.get("store") || "playstore";
  const country = req.nextUrl.searchParams.get("country") || "US";
  const effectiveCountry = country === "ALL" ? "US" : country;

  if (!appId) {
    return NextResponse.json({ error: "Missing appId" }, { status: 400 });
  }

  try {
    let listing: StoreListingData;

    if (store === "playstore") {
      listing = await fetchPlayStoreListing(appId, effectiveCountry);
    } else {
      listing = await fetchAppStoreListing(appId, effectiveCountry);
    }

    return NextResponse.json(listing);
  } catch (err) {
    console.error(`[StoreListing] Error for ${store}/${appId}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch store listing" },
      { status: 500 }
    );
  }
}

async function fetchPlayStoreListing(
  appId: string,
  country: string
): Promise<StoreListingData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app: any = await gplay.app({ appId, country });

  // Google Play events: check recentChanges and promotional text
  const events: AppEvent[] = [];
  if (app.recentChanges) {
    events.push({
      name: "What's New",
      description: app.recentChanges.replace(/<[^>]*>/g, "").trim(),
      badge: "Update",
    });
  }
  if (app.sale || app.originalPrice) {
    events.push({
      name: app.originalPrice ? `Sale: was ${app.originalPrice}` : "On Sale",
      description: app.priceText || "Discounted",
      badge: "Promotion",
    });
  }
  if (app.preregister) {
    events.push({ name: "Pre-registration Open", badge: "Pre-register" });
  }
  if (app.earlyAccessEnabled) {
    events.push({ name: "Early Access Available", badge: "Early Access" });
  }

  return {
    title: app.title || "",
    subtitle: app.summary || "",
    description: app.description || "",
    screenshots: app.screenshots || [],
    video: app.video || undefined,
    icon: app.icon || "",
    developer: app.developer || "",
    rating: app.score || undefined,
    installs: app.installs || undefined,
    events: events.length > 0 ? events : undefined,
  };
}

async function fetchAppStoreListing(
  appId: string,
  country: string
): Promise<StoreListingData> {
  // Fetch basic data from iTunes API (fast) and scrape web page for
  // App Preview video + In-App Events (slower, runs in parallel)
  const [itunesData, webData] = await Promise.all([
    fetchItunesData(appId, country),
    scrapeAppStorePage(appId, country),
  ]);

  return {
    ...itunesData,
    video: webData.video || itunesData.video,
    events: webData.events?.length ? webData.events : undefined,
  };
}

async function fetchItunesData(
  appId: string,
  country: string
): Promise<StoreListingData> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${appId}&country=${country}`
  );
  if (!res.ok) throw new Error(`iTunes API returned ${res.status}`);

  const data = await res.json();
  const app = data.results?.[0];
  if (!app) throw new Error("App not found in iTunes");

  return {
    title: app.trackName || "",
    subtitle: app.subtitle || undefined,
    description: app.description || "",
    screenshots: app.screenshotUrls || [],
    video: undefined, // iTunes API doesn't return App Preview videos for apps
    icon: app.artworkUrl512 || app.artworkUrl100 || "",
    developer: app.artistName || "",
    rating: app.averageUserRating || undefined,
  };
}

// Scrape the App Store web page for App Preview videos and In-App Events
async function scrapeAppStorePage(
  appId: string,
  country: string
): Promise<{ video?: string; events?: AppEvent[] }> {
  let context;
  try {
    const { context: ctx, page } = await createPage();
    context = ctx;

    const url = `https://apps.apple.com/${country.toLowerCase()}/app/id${appId}`;
    console.log(`[AppStore] Scraping web page: ${url}`);

    // Use networkidle to ensure JS-loaded video elements are rendered
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait specifically for video elements if they exist
    await page.waitForSelector('video, [class*="preview"], [class*="video"]', { timeout: 8000 }).catch(() => null);

    // Extract App Preview video URL — multiple strategies
    const video = await page.evaluate(() => {
      // Strategy 1: <video> with <source> children
      const sources = document.querySelectorAll('video source[src]');
      for (const src of sources) {
        const url = src.getAttribute("src");
        if (url && (url.includes("mzstatic.com") || url.endsWith(".mp4") || url.endsWith(".m3u8"))) return url;
      }

      // Strategy 2: <video src="..."> directly
      const videos = document.querySelectorAll('video[src]');
      for (const vid of videos) {
        const url = vid.getAttribute("src");
        if (url && (url.includes("mzstatic.com") || url.endsWith(".mp4"))) return url;
      }

      // Strategy 3: any element with a src pointing to Apple's video CDN
      const mediaEls = document.querySelectorAll('[src*="mzstatic.com"]');
      for (const el of mediaEls) {
        const src = el.getAttribute("src") || "";
        if (src.match(/\.(mp4|m3u8|mov)/i)) return src;
      }

      // Strategy 4: search inline <script> blocks for video URLs
      const scripts = document.querySelectorAll('script:not([src])');
      for (const script of scripts) {
        const text = script.textContent || "";
        const match = text.match(/https?:\/\/[^"'\s]+mzstatic\.com[^"'\s]*\.(?:mp4|m3u8|mov)/i);
        if (match) return match[0];
      }

      // Strategy 5: check meta tags (og:video, twitter:player)
      const ogVideo = document.querySelector('meta[property="og:video"]')?.getAttribute("content");
      if (ogVideo) return ogVideo;
      const twitterPlayer = document.querySelector('meta[name="twitter:player:stream"]')?.getAttribute("content");
      if (twitterPlayer) return twitterPlayer;

      return null;
    });

    // Extract In-App Events
    const events: AppEvent[] = await page.evaluate(() => {
      const results: { name: string; description?: string; imageUrl?: string; badge?: string }[] = [];

      // In-App Events section on the App Store page
      const eventElements = document.querySelectorAll(
        '[class*="event"], [data-test-event], .l-row.in-app-events .we-event'
      );
      for (const el of eventElements) {
        const name = el.querySelector('h3, [class*="title"], .we-event__title')?.textContent?.trim();
        if (!name) continue;
        const desc = el.querySelector('p, [class*="description"], .we-event__description')?.textContent?.trim();
        const img = el.querySelector('img')?.getAttribute("src") || undefined;
        const badge = el.querySelector('[class*="badge"], .we-event__badge')?.textContent?.trim();
        results.push({ name, description: desc || undefined, imageUrl: img, badge: badge || "Event" });
      }

      // Alternative: look for event cards in a more generic way
      if (results.length === 0) {
        const sections = document.querySelectorAll('section');
        for (const section of sections) {
          const heading = section.querySelector('h2');
          if (heading && /event/i.test(heading.textContent || "")) {
            const cards = section.querySelectorAll('[class*="card"], li');
            for (const card of cards) {
              const name = card.querySelector('h3, [class*="title"]')?.textContent?.trim();
              if (name) {
                const desc = card.querySelector('p')?.textContent?.trim();
                const img = card.querySelector('img')?.getAttribute("src") || undefined;
                results.push({ name, description: desc || undefined, imageUrl: img, badge: "Event" });
              }
            }
          }
        }
      }

      return results;
    });

    console.log(`[AppStore] Found video: ${!!video}, events: ${events.length}`);
    return { video: video || undefined, events };
  } catch (err) {
    console.error("[AppStore] Web scraping failed:", err);
    return {};
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
