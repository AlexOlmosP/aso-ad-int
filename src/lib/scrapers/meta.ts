import type { BrowserContext } from "playwright-core";
import type { AdCreative } from "@/lib/types";
import { createPage } from "./browser";

interface MetaScrapeParams {
  metaPageId: string;
  country: string;
  mediaType: string;
  limit?: number;
}

export async function scrapeMetaAds(params: MetaScrapeParams): Promise<AdCreative[]> {
  const { metaPageId, country, mediaType, limit = 5 } = params;
  let context: BrowserContext | null = null;

  const url =
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${country}&is_targeted_country=false&media_type=${mediaType}` +
    `&search_type=page&sort_data[direction]=desc&sort_data[mode]=total_impressions` +
    `&view_all_page_id=${metaPageId}`;

  console.log(`[Meta] Scraping: ${url.substring(0, 120)}...`);

  try {
    const { context: ctx, page } = await createPage();
    context = ctx;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectedAds: any[] = [];
    let responseCount = 0;
    let jsonResponseCount = 0;

    // Set up response listener BEFORE navigating (fix race condition)
    page.on("response", async (response) => {
      try {
        responseCount++;
        const contentType = response.headers()["content-type"] || "";
        // Only process JSON/text responses, skip images/css/js
        if (!contentType.includes("json") && !contentType.includes("text/html") && !contentType.includes("text/plain")) return;

        // Skip non-XHR responses (static assets, etc)
        const resUrl = response.url();
        if (resUrl.endsWith(".js") || resUrl.endsWith(".css") || resUrl.includes("/static/")) return;

        let text: string;
        try {
          text = await response.text();
        } catch {
          return; // Body not available (redirects, etc)
        }

        if (!text.includes("ad_archive_id")) return;

        jsonResponseCount++;

        // Meta sometimes returns multiple JSON objects separated by newlines
        const jsonStrings = text.split("\n").filter((line) => line.trim().startsWith("{"));

        for (const jsonStr of jsonStrings) {
          try {
            const data = JSON.parse(jsonStr);
            extractAdsFromGraphQL(data, collectedAds);
          } catch {
            // Not valid JSON, skip
          }
        }
      } catch {
        // Response processing error, skip
      }
    });

    // Navigate to the Ad Library page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Wait for initial page load
    await page.waitForTimeout(3000);

    // Dismiss cookie consent / login modals that block page interaction
    for (const selector of [
      'button[data-cookiebanner="accept_button"]',
      'button[title="Allow all cookies"]',
      'button[title="Accept All"]',
      'button[title="Allow essential and optional cookies"]',
      '[aria-label="Allow all cookies"]',
      '[aria-label="Close"]',
    ]) {
      try {
        const btn = await page.$(selector);
        if (btn && await btn.isVisible()) {
          await btn.click();
          console.log(`[Meta] Dismissed dialog via: ${selector}`);
          await page.waitForTimeout(1500);
          break;
        }
      } catch { /* skip */ }
    }

    // Wait for API calls to complete after consent is handled
    await page.waitForTimeout(6000);

    // Check if we got redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("checkpoint")) {
      console.log("[Meta] Redirected to login page — cannot scrape without authentication");
      return [];
    }

    // Scroll to trigger lazy loading of more ads
    for (let i = 0; i < 3 && collectedAds.length < limit; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(3000);
    }

    console.log(`[Meta] Total responses: ${responseCount}, JSON with ad data: ${jsonResponseCount}, Ads extracted: ${collectedAds.length}`);

    if (collectedAds.length === 0) {
      const title = await page.title();
      console.log(`[Meta] Page title: "${title}", URL: ${currentUrl.substring(0, 100)}`);

      // Fallback: if a specific media_type returned nothing, retry with "all"
      if (mediaType !== "all") {
        console.log(`[Meta] Retrying with media_type=all (was "${mediaType}")...`);
        const fallbackUrl =
          `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
          `&country=${country}&is_targeted_country=false&media_type=all` +
          `&search_type=page&sort_data[direction]=desc&sort_data[mode]=total_impressions` +
          `&view_all_page_id=${metaPageId}`;
        await page.goto(fallbackUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(8000);
        for (let i = 0; i < 2 && collectedAds.length < limit; i++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(3000);
        }
        console.log(`[Meta] Fallback collected: ${collectedAds.length} ads`);
      }
    }

    const ads = collectedAds.slice(0, limit).map((item, i) => mapGraphQLAdToCreative(item, i));
    return ads;
  } catch (err) {
    console.error("[Meta] Scraping error:", err);
    return [];
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// Recursively search response data for ad objects with ad_archive_id + snapshot
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAdsFromGraphQL(obj: any, results: any[]): void {
  if (!obj || typeof obj !== "object") return;

  // An ad object has ad_archive_id and snapshot
  if (obj.ad_archive_id && obj.snapshot) {
    if (!results.some((r) => r.ad_archive_id === obj.ad_archive_id)) {
      results.push(obj);
    }
    return;
  }

  // Also check for alternate field names
  if (obj.adArchiveID && obj.snapshot) {
    if (!results.some((r) => r.adArchiveID === obj.adArchiveID)) {
      results.push({ ...obj, ad_archive_id: obj.adArchiveID });
    }
    return;
  }

  // Recurse into arrays and objects
  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractAdsFromGraphQL(item, results);
    }
  } else {
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        extractAdsFromGraphQL(value, results);
      }
    }
  }
}

// Recursively find the first URL matching a pattern in a nested object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findUrl(obj: any, pattern: RegExp, depth = 0): string | undefined {
  if (depth > 8 || !obj) return undefined;
  if (typeof obj === "string" && pattern.test(obj)) return obj;
  if (typeof obj !== "object") return undefined;
  const entries = Array.isArray(obj) ? obj : Object.values(obj);
  for (const val of entries) {
    const found = findUrl(val, pattern, depth + 1);
    if (found) return found;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGraphQLAdToCreative(item: any, index: number): AdCreative {
  const snapshot = item.snapshot ?? {};
  const firstCard = snapshot.cards?.[0] ?? {};

  // Debug: log structure of first ad so we can see actual field names
  if (index === 0) {
    console.log("[Meta] Sample snapshot keys:", JSON.stringify(Object.keys(snapshot)));
    console.log("[Meta] Sample firstCard keys:", JSON.stringify(Object.keys(firstCard)));
    // Log a truncated view to see available media fields
    const snapshotStr = JSON.stringify(snapshot);
    console.log("[Meta] Sample snapshot (1500 chars):", snapshotStr.substring(0, 1500));
  }

  // --- Video URL extraction (try many known field paths) ---
  const videoUrl =
    // Direct card fields
    firstCard.video_sd_url || firstCard.video_hd_url ||
    firstCard.video?.video_sd_url || firstCard.video?.video_hd_url ||
    // Snapshot-level fields
    snapshot.video_sd_url || snapshot.video_hd_url ||
    // Nested videos array
    snapshot.videos?.[0]?.video_sd_url || snapshot.videos?.[0]?.video_hd_url ||
    // Alternative field names
    firstCard.video_url || snapshot.video_url || snapshot.video ||
    firstCard.video_preview_url ||
    // Deep search: find any fbcdn/scontent video URL in the entire snapshot
    findUrl(snapshot, /https?:\/\/[^\s"]*(?:fbcdn|scontent)[^\s"]*\.mp4/i) ||
    undefined;

  // --- Image URL extraction (try many known field paths) ---
  const imageUrl =
    // Card-level image fields
    firstCard.video_preview_image_url || firstCard.resized_image_url || firstCard.original_image_url ||
    firstCard.image_url || firstCard.image ||
    // Snapshot-level image fields
    snapshot.video_preview_image_url || snapshot.resized_image_url || snapshot.original_image_url ||
    snapshot.image_url || snapshot.image ||
    // Nested images array
    snapshot.images?.[0]?.resized_image_url || snapshot.images?.[0]?.original_image_url ||
    snapshot.images?.[0]?.url ||
    // Deep search: find any fbcdn/scontent image URL in the entire snapshot
    findUrl(snapshot, /https?:\/\/[^\s"]*(?:fbcdn|scontent)[^\s"]*\.(?:jpg|jpeg|png|webp)/i) ||
    "";

  // Detect format from content, not just videoUrl presence
  let format: string;
  if (videoUrl) {
    format = "video";
  } else if (snapshot.cards?.length > 1) {
    format = "carousel";
  } else {
    // Check if the snapshot structurally looks like a video ad
    const hasVideoKeys = !!(snapshot.video_sd_url || snapshot.video_hd_url ||
      snapshot.videos?.length || findUrl(snapshot, /video/i));
    format = hasVideoKeys ? "video" : "image";
  }

  return {
    id: `meta-${item.ad_archive_id ?? index}-${Date.now()}`,
    network: "meta",
    title: firstCard.title || firstCard.link_description || snapshot.caption || item.page_name || "",
    body: firstCard.body || snapshot.body?.text || snapshot.body?.markup?.__html || "",
    imageUrl,
    videoUrl,
    format,
    impressions: parseImpressions(item.impressions_with_index?.impressions_text),
    startDate: formatDate(item.start_date) || item.start_date_formatted || "",
    endDate: formatDate(item.end_date) || item.end_date_formatted || "",
    isActive: item.is_active ?? true,
    url: item.ad_library_url || firstCard.link_url || "",
    advertiserName: item.page_name || snapshot.page_name || "",
  };
}

function formatDate(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string" && val.includes("-")) return val; // Already formatted
  const num = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(num)) return "";
  const ms = num < 10_000_000_000 ? num * 1000 : num;
  try {
    return new Date(ms).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function parseImpressions(val: string | number | undefined): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const cleaned = val.replace(/[^0-9.kmb]/gi, "").toLowerCase();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (cleaned.includes("b")) return num * 1_000_000_000;
  if (cleaned.includes("m")) return num * 1_000_000;
  if (cleaned.includes("k")) return num * 1_000;
  return num;
}
