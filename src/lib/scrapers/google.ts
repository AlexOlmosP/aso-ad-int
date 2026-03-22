import type { BrowserContext } from "playwright-core";
import type { AdCreative } from "@/lib/types";
import { createPage } from "./browser";

interface GoogleScrapeParams {
  googleAdId: string;
  limit?: number;
}

// Render a content.js ad preview in Playwright and screenshot it
async function screenshotCreative(context: BrowserContext, previewUrl: string): Promise<string> {
  const page = await context.newPage();
  try {
    // Use a proper viewport so ads render at their real size
    await page.setViewportSize({ width: 640, height: 480 });

    const url = new URL(previewUrl);
    const containerId = url.searchParams.get("htmlParentId") || "ad-container";
    const callback = url.searchParams.get("responseCallback") || "cb";

    await page.setContent(`<!DOCTYPE html>
<html><head><style>*{margin:0;padding:0;box-sizing:border-box}
body{background:#f1f5f9;width:100vw;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center}
#${containerId}{width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}
</style></head>
<body><div id="${containerId}"></div>
<script>window["${callback}"]=function(){};</script>
<script src="${previewUrl}"></script></body></html>`);
    await page.waitForTimeout(4000);
    const buf = await page.screenshot({ type: "jpeg", quality: 80 });
    return "data:image/jpeg;base64," + buf.toString("base64");
  } catch (err) {
    console.log("[Google] Screenshot failed:", err);
    return "";
  } finally {
    await page.close();
  }
}

export async function scrapeGoogleAds(params: GoogleScrapeParams): Promise<AdCreative[]> {
  const { googleAdId, limit = 5 } = params;
  let context: BrowserContext | null = null;

  const url = `https://adstransparency.google.com/advertiser/${googleAdId}?region=anywhere&format=VIDEO`;

  console.log(`[Google] Scraping: ${url}`);

  try {
    const { context: ctx, page } = await createPage();
    context = ctx;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rpcData: any = null;
    let responseCount = 0;

    // Intercept the SearchCreatives RPC response
    page.on("response", async (response) => {
      try {
        responseCount++;
        const resUrl = response.url();

        // Look for the SearchCreatives RPC endpoint
        if (resUrl.includes("SearchCreatives") || resUrl.includes("SearchService")) {
          console.log(`[Google] Intercepted RPC response: ${resUrl.substring(0, 100)}`);
          try {
            const text = await response.text();
            // Google's RPC responses can be prefixed with ")]}'" for XSS protection
            const cleanText = text.replace(/^\)\]\}'\n?/, "");
            rpcData = JSON.parse(cleanText);
            console.log(`[Google] Parsed RPC response, keys: ${Object.keys(rpcData).join(", ")}`);
          } catch {
            // Try parsing as-is
            try {
              rpcData = await response.json();
            } catch {
              console.log("[Google] Could not parse RPC response body");
            }
          }
        }
      } catch {
        // Skip
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);

    console.log(`[Google] Total responses intercepted: ${responseCount}`);

    // If we got RPC data, extract creatives from it
    if (rpcData) {
      const creatives = extractCreativesFromRPC(rpcData);
      console.log(`[Google] Extracted ${creatives.length} creatives from RPC`);

      const mapped = creatives.slice(0, limit).map((creative, i) =>
        mapGoogleCreative(creative, googleAdId, i)
      );

      // Screenshot each creative's content.js embed to get a thumbnail
      console.log(`[Google] Taking screenshots of ${mapped.length} creatives...`);
      await Promise.all(
        mapped.map(async (ad) => {
          if (!ad.previewUrl) return;
          ad.imageUrl = await screenshotCreative(context!, ad.previewUrl);
        })
      );

      return mapped;
    }

    // Fallback: try direct RPC call
    console.log("[Google] No RPC response intercepted, trying direct API call...");
    return await directRPCFetch(googleAdId, limit);
  } catch (err) {
    console.error("[Google] Scraping error:", err);
    return [];
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// Try calling Google's internal RPC endpoint directly
async function directRPCFetch(googleAdId: string, limit: number): Promise<AdCreative[]> {
  const rpcUrl = "https://adstransparency.google.com/anji/_/rpc/SearchService/SearchCreatives?authuser=0";

  try {
    const requestBody = JSON.stringify({
      "1": { "3": googleAdId },
      "2": { "1": 1 },
      "3": 3,
      "7": limit,
    });

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Origin": "https://adstransparency.google.com",
        "Referer": `https://adstransparency.google.com/advertiser/${googleAdId}`,
      },
      body: requestBody,
    });

    if (!response.ok) {
      console.error(`[Google] Direct RPC returned ${response.status}: ${response.statusText}`);
      return [];
    }

    let data;
    try {
      const text = await response.text();
      const cleanText = text.replace(/^\)\]\}'\n?/, "");
      data = JSON.parse(cleanText);
    } catch {
      data = await response.json();
    }

    const creatives = extractCreativesFromRPC(data);
    console.log(`[Google] Direct RPC returned ${creatives.length} creatives`);

    return creatives.slice(0, limit).map((creative, i) =>
      mapGoogleCreative(creative, googleAdId, i)
    );
  } catch (err) {
    console.error("[Google] Direct RPC error:", err);
    return [];
  }
}

// Extract creative array from Google's numeric-key RPC response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCreativesFromRPC(data: any): any[] {
  if (!data) return [];

  // Try key "1" first (most common)
  if (Array.isArray(data["1"])) return data["1"];

  // Search for any array of objects
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      return val;
    }
  }

  // Maybe the data itself is an array
  if (Array.isArray(data)) return data;

  return [];
}

// Extract text strings from creative content for ad copy
// Google's RPC nests text in various sub-keys of "3" (creative content)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromCreative(creative: any): { title: string; body: string } {
  const content = creative["3"];
  if (!content) return { title: "", body: "" };

  const texts: string[] = [];

  // Recursively collect all string values from the creative content,
  // excluding URLs and very short strings (likely IDs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function collectStrings(obj: any, depth: number): void {
    if (depth > 6 || !obj) return;
    if (typeof obj === "string") {
      const trimmed = obj.trim();
      if (trimmed.length >= 3 && !trimmed.startsWith("http") && !trimmed.startsWith("CR") &&
          !trimmed.startsWith("AR") && !/^\d+$/.test(trimmed)) {
        texts.push(trimmed);
      }
      return;
    }
    if (typeof obj !== "object") return;
    const entries = Array.isArray(obj) ? obj : Object.values(obj);
    for (const val of entries) {
      collectStrings(val, depth + 1);
    }
  }

  collectStrings(content, 0);

  // Also check key "5" and "8" at the top level — sometimes contains ad text
  for (const k of ["5", "8", "9", "10", "11"]) {
    if (typeof creative[k] === "string" && creative[k].length >= 3) {
      texts.push(creative[k]);
    }
  }

  // First text is likely the headline, second is the body
  const title = texts[0] || "";
  const body = texts.slice(1).join(" — ") || "";
  return { title, body };
}

// Map Google's numeric-key creative object to AdCreative
// Actual RPC response structure (discovered via debug logging):
//   "1" = advertiser_id
//   "2" = creative_id (CR...)
//   "3" = creative content (nested: "3"."1"."4" = preview URL)
//   "4" = format code (3 = video, 2 = image, 1 = text)
//   "6" = first shown { "1": timestamp_seconds, "2": nanoseconds }
//   "7" = last shown { "1": timestamp_seconds, "2": nanoseconds }
//   "12" = advertiser name (string)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGoogleCreative(creative: any, advertiserId: string, index: number): AdCreative {
  const creativeId = creative["2"] || `${index}`;
  const formatCode = creative["4"];
  const firstShown = parseTimestamp(creative["6"]?.["1"]);
  const lastShown = parseTimestamp(creative["7"]?.["1"]);

  // Creative preview URL is nested at "3"."1"."4" — this is a content.js embed
  let previewUrl = "";
  const embedUrl = creative["3"]?.["1"]?.["4"];
  if (typeof embedUrl === "string" && embedUrl.startsWith("http")) {
    previewUrl = embedUrl;
  }

  // Advertiser name is at key "12"
  const advertiserName = typeof creative["12"] === "string" ? creative["12"] : advertiserId;

  // Extract ad copy text from the creative content
  const extracted = extractTextFromCreative(creative);

  return {
    id: `google-${creativeId}-${Date.now()}`,
    network: "google",
    title: extracted.title || advertiserName,
    body: extracted.body,
    imageUrl: "",
    videoUrl: undefined,
    previewUrl,
    format: formatCode === 3 ? "video" : formatCode === 2 ? "image" : "text",
    impressions: 0,
    startDate: firstShown,
    endDate: lastShown,
    isActive: true,
    url: `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${creativeId}`,
    advertiserName,
  };
}

// ─── Search Google Ads Transparency Center for advertiser candidates ───

export interface GoogleAdvertiserCandidate {
  name: string;
  arId: string;
}

export async function searchGoogleAdvertisers(query: string): Promise<GoogleAdvertiserCandidate[]> {
  console.error(`[Google] Searching advertisers for: "${query}"`);

  let context: BrowserContext | null = null;
  try {
    const { context: ctx, page } = await createPage();
    context = ctx;

    const advertisers: GoogleAdvertiserCandidate[] = [];

    // Intercept ALL RPC responses to catch the autocomplete/search dropdown data
    page.on("response", async (response) => {
      try {
        const resUrl = response.url();
        if (!resUrl.includes("adstransparency.google.com")) return;
        // Capture any RPC call (Google uses various endpoints for search)
        if (!resUrl.includes("rpc") && !resUrl.includes("Search") && !resUrl.includes("Autocomplete")) return;

        let text: string;
        try { text = await response.text(); } catch { return; }
        const cleanText = text.replace(/^\)\]\}'\n?/, "");
        try {
          const data = JSON.parse(cleanText);
          extractAdvertisersFromRPCResponse(data, advertisers);
        } catch { /* skip non-JSON */ }
      } catch { /* skip */ }
    });

    // Navigate to the transparency center
    await page.goto("https://adstransparency.google.com/?region=anywhere", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Find the search input and type the query
    // Google Ads Transparency uses a search input — try multiple selectors
    const searchSelectors = [
      'input[type="search"]',
      'input[aria-label*="search" i]',
      'input[aria-label*="Search" i]',
      'input[placeholder*="search" i]',
      'input[placeholder*="advertiser" i]',
      'input[role="searchbox"]',
      'input[role="combobox"]',
      'search-box input',
      '.search-input input',
      'input',
    ];

    let typed = false;
    for (const selector of searchSelectors) {
      try {
        const input = await page.$(selector);
        if (input && await input.isVisible()) {
          await input.click();
          await page.waitForTimeout(500);
          await input.fill(query);
          await page.waitForTimeout(1000);
          // Also try pressing keys to trigger autocomplete
          await input.press("Space");
          await page.waitForTimeout(500);
          await input.press("Backspace");
          typed = true;
          console.error(`[Google] Typed query using selector: ${selector}`);
          break;
        }
      } catch { /* try next selector */ }
    }

    if (!typed) {
      // Last resort: try keyboard typing after clicking on the page
      console.error("[Google] No search input found, trying keyboard approach");
      await page.keyboard.type(query, { delay: 50 });
    }

    // Wait for dropdown/autocomplete results to load
    await page.waitForTimeout(4000);

    // If RPC interception found results, return them
    if (advertisers.length > 0) {
      console.error(`[Google] RPC interception found ${advertisers.length} advertisers`);
      return advertisers;
    }

    // Fallback: Try to extract from DOM dropdown elements
    console.error("[Google] No RPC results, trying DOM extraction...");
    const domResults = await page.evaluate(() => {
      const results: { name: string; arId: string }[] = [];

      // Look for dropdown items / suggestion items / links containing AR IDs
      const allLinks = document.querySelectorAll('a[href*="/advertiser/AR"]');
      for (const link of allLinks) {
        const href = link.getAttribute("href") || "";
        const arMatch = href.match(/(AR\d{18,22})/);
        if (arMatch) {
          const name = link.textContent?.trim() || "";
          if (name && !results.some(r => r.arId === arMatch[1])) {
            results.push({ name, arId: arMatch[1] });
          }
        }
      }

      // Also search for any element containing AR IDs
      if (results.length === 0) {
        const allElements = document.querySelectorAll('[class*="result"], [class*="item"], [class*="suggestion"], [role="option"], [role="listbox"] > *, li');
        for (const el of allElements) {
          const text = el.textContent || "";
          const arMatch = text.match(/(AR\d{18,22})/);
          // Also check for links inside the element
          const innerLink = el.querySelector('a[href*="/advertiser/"]');
          const innerHref = innerLink?.getAttribute("href") || "";
          const innerArMatch = innerHref.match(/(AR\d{18,22})/);

          if (arMatch || innerArMatch) {
            const arId = arMatch?.[1] || innerArMatch?.[1] || "";
            // Get the display name (first meaningful text)
            const nameEl = el.querySelector('[class*="name"], [class*="title"], span, div');
            const name = nameEl?.textContent?.trim() || el.textContent?.trim().split("\n")[0]?.trim() || "";
            if (name && arId && !results.some(r => r.arId === arId)) {
              results.push({ name: name.substring(0, 100), arId });
            }
          }
        }
      }

      return results;
    });

    for (const r of domResults) {
      if (!advertisers.some(a => a.arId === r.arId)) {
        advertisers.push(r);
      }
    }

    // If still no results, try clicking the first dropdown option and extracting from URL
    if (advertisers.length === 0) {
      console.error("[Google] Trying to click first dropdown option...");
      try {
        // Try clicking on suggestion items
        const clickSelectors = [
          '[role="option"]',
          '[role="listbox"] > *:first-child',
          '[class*="suggestion"]:first-child',
          '[class*="result"]:first-child',
        ];
        for (const sel of clickSelectors) {
          const el = await page.$(sel);
          if (el && await el.isVisible()) {
            const optionText = await el.textContent();
            await el.click();
            await page.waitForTimeout(3000);
            // Check if URL now contains an AR ID
            const currentUrl = page.url();
            const urlMatch = currentUrl.match(/(AR\d{18,22})/);
            if (urlMatch) {
              advertisers.push({
                name: optionText?.trim() || query,
                arId: urlMatch[1],
              });
            }
            break;
          }
        }
      } catch { /* skip */ }
    }

    console.error(`[Google] Total found: ${advertisers.length} advertisers for "${query}"`);
    return advertisers;
  } catch (err) {
    console.error("[Google] Advertiser search error:", err);
    return [];
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// Extract advertiser AR IDs from Google's RPC response data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAdvertisersFromRPCResponse(data: any, results: GoogleAdvertiserCandidate[]): void {
  if (!data || typeof data !== "object") return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function search(obj: any, depth: number): void {
    if (depth > 10 || !obj) return;
    if (typeof obj !== "object") return;

    // Look for AR ID strings anywhere in the object
    if (!Array.isArray(obj)) {
      const values = Object.values(obj);
      for (const val of values) {
        if (typeof val === "string" && /^AR\d{18,22}$/.test(val)) {
          const name = findAdvertiserName(obj);
          if (name && !results.some(r => r.arId === val)) {
            results.push({ name, arId: val });
          }
        }
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) search(item, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (val && typeof val === "object") search(val, depth + 1);
      }
    }
  }

  search(data, 0);
}

// Find an advertiser name near an AR ID in a Google RPC object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findAdvertiserName(obj: any): string {
  for (const val of Object.values(obj)) {
    if (typeof val === "string" &&
        val.length >= 2 && val.length <= 100 &&
        !val.startsWith("AR") &&
        !val.startsWith("http") &&
        !val.startsWith("CR") &&
        !/^\d+$/.test(val)) {
      return val;
    }
    if (typeof val === "object" && val && !Array.isArray(val)) {
      for (const subVal of Object.values(val as Record<string, unknown>)) {
        if (typeof subVal === "string" &&
            subVal.length >= 2 && subVal.length <= 100 &&
            !subVal.startsWith("AR") &&
            !subVal.startsWith("http") &&
            !subVal.startsWith("CR") &&
            !/^\d+$/.test(subVal)) {
          return subVal;
        }
      }
    }
  }
  return "";
}

function parseTimestamp(val: unknown): string {
  if (!val) return "";
  const num = typeof val === "string" ? parseInt(val, 10) : (typeof val === "number" ? val : 0);
  if (!num || isNaN(num)) return "";
  const ms = num < 10_000_000_000 ? num * 1000 : num;
  try {
    return new Date(ms).toISOString().split("T")[0];
  } catch {
    return "";
  }
}
