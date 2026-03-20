import type { BrowserContext } from "playwright-core";
import type { AdCreative } from "@/lib/types";
import { createPage } from "./browser";

interface MetaScrapeParams {
  metaPageId: string;
  country: string;
  mediaType: string;
  limit?: number;
}

// ─── Graph API approach (preferred, requires Ad Library API approval) ───

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const AD_FIELDS = [
  "id",
  "ad_archive_id",
  "page_name",
  "page_id",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "impressions",
  "spend",
  "currency",
  "publisher_platforms",
  "estimated_audience_size",
  "ad_snapshot_url",
].join(",");

export async function scrapeMetaAds(params: MetaScrapeParams): Promise<AdCreative[]> {
  const { limit = 5 } = params;

  // Try Graph API first if token is available
  const token = process.env.META_ACCESS_TOKEN;
  if (token) {
    const apiResult = await tryGraphApi(params, token);
    if (apiResult !== null) {
      return apiResult.slice(0, limit);
    }
    // API failed — fall through to Playwright scraper
    console.log("[Meta] Graph API unavailable, falling back to Playwright scraper...");
  }

  // Fallback: Playwright-based scraping
  return scrapeMetaAdsViaPlaywright(params);
}

async function tryGraphApi(params: MetaScrapeParams, token: string): Promise<AdCreative[] | null> {
  const { metaPageId, country, mediaType, limit = 5 } = params;
  const apiMediaType = mapMediaType(mediaType);

  const searchParams = new URLSearchParams({
    access_token: token,
    search_page_ids: metaPageId,
    ad_active_status: "active",
    ad_type: "all",
    fields: AD_FIELDS,
    limit: String(Math.min(limit * 2, 50)),
  });

  if (country && country !== "ALL") {
    searchParams.set("ad_reached_countries", `["${country}"]`);
  }
  if (apiMediaType) {
    searchParams.set("ad_media_type", apiMediaType);
  }

  const url = `${GRAPH_API_BASE}/ads_archive?${searchParams.toString()}`;
  console.log(`[Meta] Graph API request: search_page_ids=${metaPageId}, country=${country}, media=${apiMediaType || "all"}`);

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (json.error) {
      console.error("[Meta] API error:", json.error.message);
      if (json.error.code === 190) {
        console.error("[Meta] Token expired or invalid — generate a new one at https://developers.facebook.com/tools/explorer/");
      }
      return null; // Signal to fall back to Playwright
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = json.data || [];
    console.log(`[Meta] API returned ${data.length} ads`);

    if (data.length > 0) {
      console.log("[Meta] Sample ad keys:", Object.keys(data[0]).join(", "));
    }

    return data.slice(0, limit).map((item, i) => mapApiAdToCreative(item, i));
  } catch (err) {
    console.error("[Meta] API fetch error:", err);
    return null;
  }
}

function mapMediaType(mediaType: string): string | undefined {
  switch (mediaType.toLowerCase()) {
    case "video": return "VIDEO";
    case "image": return "IMAGE";
    case "meme": return "MEME";
    default: return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiAdToCreative(item: any, index: number): AdCreative {
  const impressions = parseImpressionRange(item.impressions);
  const spend = parseSpendRange(item.spend, item.currency);
  const startDate = item.ad_delivery_start_time?.split("T")[0] || "";
  const endDate = item.ad_delivery_stop_time?.split("T")[0] || "";
  const body = item.ad_creative_bodies?.[0] || "";
  const title = item.ad_creative_link_titles?.[0] || "";
  const linkDesc = item.ad_creative_link_descriptions?.[0] || "";
  const bodies = item.ad_creative_bodies || [];
  const titles = item.ad_creative_link_titles || [];
  const format = (bodies.length > 1 || titles.length > 1) ? "carousel" : "image";

  return {
    id: `meta-${item.ad_archive_id ?? item.id ?? index}-${Date.now()}`,
    network: "meta",
    title: title || linkDesc || item.page_name || "",
    body,
    imageUrl: "",
    videoUrl: undefined,
    previewUrl: item.ad_snapshot_url || undefined,
    format,
    impressions,
    startDate,
    endDate,
    isActive: !item.ad_delivery_stop_time,
    url: item.ad_snapshot_url || "",
    ctr: spend ? `${spend}` : undefined,
    advertiserName: item.page_name || "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseImpressionRange(impressions: any): number {
  if (!impressions) return 0;
  const lower = parseInt(impressions.lower_bound || "0", 10);
  const upper = parseInt(impressions.upper_bound || "0", 10);
  if (upper > 0) return Math.round((lower + upper) / 2);
  return lower;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSpendRange(spend: any, currency?: string): string | undefined {
  if (!spend) return undefined;
  const lower = parseInt(spend.lower_bound || "0", 10);
  const upper = parseInt(spend.upper_bound || "0", 10);
  const curr = currency || "USD";
  if (upper > 0) return `${curr} ${lower}-${upper}`;
  if (lower > 0) return `${curr} ${lower}+`;
  return undefined;
}

// ─── Playwright scraper fallback ───

async function scrapeMetaAdsViaPlaywright(params: MetaScrapeParams): Promise<AdCreative[]> {
  const { metaPageId, country, mediaType, limit = 5 } = params;
  let context: BrowserContext | null = null;

  const url =
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${country}&is_targeted_country=false&media_type=${mediaType}` +
    `&search_type=page&sort_data[direction]=desc&sort_data[mode]=total_impressions` +
    `&view_all_page_id=${metaPageId}`;

  console.log(`[Meta] Playwright scraping: ${url.substring(0, 120)}...`);

  try {
    const { context: ctx, page } = await createPage();
    context = ctx;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectedAds: any[] = [];

    page.on("response", async (response) => {
      try {
        const contentType = response.headers()["content-type"] || "";
        if (!contentType.includes("json") && !contentType.includes("text/html") && !contentType.includes("text/plain")) return;
        const resUrl = response.url();
        if (resUrl.endsWith(".js") || resUrl.endsWith(".css") || resUrl.includes("/static/")) return;

        let text: string;
        try { text = await response.text(); } catch { return; }
        if (!text.includes("ad_archive_id")) return;

        const jsonStrings = text.split("\n").filter((line) => line.trim().startsWith("{"));
        for (const jsonStr of jsonStrings) {
          try {
            const data = JSON.parse(jsonStr);
            extractAdsFromGraphQL(data, collectedAds);
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Dismiss cookie consent / login modals
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

    await page.waitForTimeout(6000);

    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("checkpoint")) {
      console.log("[Meta] Redirected to login page — cannot scrape without authentication");
      return [];
    }

    // Scroll to load more ads
    for (let i = 0; i < 3 && collectedAds.length < limit; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(3000);
    }

    console.log(`[Meta] Playwright extracted: ${collectedAds.length} ads`);

    if (collectedAds.length === 0 && mediaType !== "all") {
      console.log(`[Meta] Retrying with media_type=all...`);
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

    return collectedAds.slice(0, limit).map((item, i) => mapPlaywrightAdToCreative(item, i));
  } catch (err) {
    console.error("[Meta] Playwright scraping error:", err);
    return [];
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAdsFromGraphQL(obj: any, results: any[]): void {
  if (!obj || typeof obj !== "object") return;
  if (obj.ad_archive_id && obj.snapshot) {
    if (!results.some((r) => r.ad_archive_id === obj.ad_archive_id)) results.push(obj);
    return;
  }
  if (obj.adArchiveID && obj.snapshot) {
    if (!results.some((r) => r.adArchiveID === obj.adArchiveID)) {
      results.push({ ...obj, ad_archive_id: obj.adArchiveID });
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) extractAdsFromGraphQL(item, results);
  } else {
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") extractAdsFromGraphQL(value, results);
    }
  }
}

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
function mapPlaywrightAdToCreative(item: any, index: number): AdCreative {
  const snapshot = item.snapshot ?? {};
  const firstCard = snapshot.cards?.[0] ?? {};

  const videoUrl =
    firstCard.video_sd_url || firstCard.video_hd_url ||
    firstCard.video?.video_sd_url || firstCard.video?.video_hd_url ||
    snapshot.video_sd_url || snapshot.video_hd_url ||
    snapshot.videos?.[0]?.video_sd_url || snapshot.videos?.[0]?.video_hd_url ||
    firstCard.video_url || snapshot.video_url || snapshot.video ||
    findUrl(snapshot, /https?:\/\/[^\s"]*(?:fbcdn|scontent)[^\s"]*\.mp4/i) ||
    undefined;

  const imageUrl =
    firstCard.video_preview_image_url || firstCard.resized_image_url || firstCard.original_image_url ||
    firstCard.image_url || firstCard.image ||
    snapshot.video_preview_image_url || snapshot.resized_image_url || snapshot.original_image_url ||
    snapshot.image_url || snapshot.image ||
    snapshot.images?.[0]?.resized_image_url || snapshot.images?.[0]?.original_image_url ||
    findUrl(snapshot, /https?:\/\/[^\s"]*(?:fbcdn|scontent)[^\s"]*\.(?:jpg|jpeg|png|webp)/i) ||
    "";

  let format: string;
  if (videoUrl) {
    format = "video";
  } else if (snapshot.cards?.length > 1) {
    format = "carousel";
  } else {
    format = "image";
  }

  return {
    id: `meta-${item.ad_archive_id ?? index}-${Date.now()}`,
    network: "meta",
    title: firstCard.title || firstCard.link_description || snapshot.caption || item.page_name || "",
    body: firstCard.body || snapshot.body?.text || snapshot.body?.markup?.__html || "",
    imageUrl,
    videoUrl,
    format,
    impressions: parsePlaywrightImpressions(item.impressions_with_index?.impressions_text),
    startDate: formatDate(item.start_date) || item.start_date_formatted || "",
    endDate: formatDate(item.end_date) || item.end_date_formatted || "",
    isActive: item.is_active ?? true,
    url: item.ad_library_url || firstCard.link_url || "",
    advertiserName: item.page_name || snapshot.page_name || "",
  };
}

function formatDate(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string" && val.includes("-")) return val;
  const num = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(num)) return "";
  const ms = num < 10_000_000_000 ? num * 1000 : num;
  try { return new Date(ms).toISOString().split("T")[0]; } catch { return ""; }
}

function parsePlaywrightImpressions(val: string | number | undefined): number {
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
