import type { BrowserContext } from "playwright-core";
import { createPage } from "./browser";

export interface TiktokAdvertiserCandidate {
  name: string;
  bizId: string;
}

export async function searchTiktokAdvertisers(query: string): Promise<TiktokAdvertiserCandidate[]> {
  // Try API approach first (TikTok Ad Library has a public API)
  const apiResult = await tryTiktokApi(query);
  if (apiResult.length > 0) return apiResult;

  // Fallback: Playwright scrape
  let context: BrowserContext | null = null;
  const url = `https://library.tiktok.com/ads?region=all&adv_name=${encodeURIComponent(query)}&adv_biz_ids=`;

  console.error(`[TikTok] Searching advertisers for: "${query}"`);

  try {
    const { context: ctx, page } = await createPage();
    context = ctx;

    const advertisers: TiktokAdvertiserCandidate[] = [];

    page.on("response", async (response) => {
      try {
        const contentType = response.headers()["content-type"] || "";
        if (!contentType.includes("json")) return;

        let text: string;
        try { text = await response.text(); } catch { return; }

        // TikTok API responses contain advertiser data
        if (!text.includes("adv_name") && !text.includes("biz_id")) return;

        try {
          const data = JSON.parse(text);
          extractTiktokAdvertisers(data, advertisers);
        } catch { /* skip */ }
      } catch { /* skip */ }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);

    // Try extracting from DOM as well
    const domResults = await page.evaluate(() => {
      const results: { name: string; bizId: string }[] = [];
      // TikTok ad library uses card-like layouts with advertiser info
      const cards = document.querySelectorAll('[class*="advertiser"], [class*="card"], [data-advertiser]');
      for (const card of cards) {
        const nameEl = card.querySelector('[class*="name"], h3, h4, [class*="title"]');
        const name = nameEl?.textContent?.trim();
        // Try to find biz ID from links or data attributes
        const link = card.querySelector('a[href*="biz_id"], a[href*="adv_biz_ids"]');
        const href = link?.getAttribute("href") || "";
        const bizIdMatch = href.match(/(?:biz_id|adv_biz_ids)=(\d{18,20})/);
        if (name && bizIdMatch) {
          results.push({ name, bizId: bizIdMatch[1] });
        }
      }
      return results;
    });

    for (const r of domResults) {
      if (!advertisers.some(a => a.bizId === r.bizId)) {
        advertisers.push(r);
      }
    }

    console.error(`[TikTok] Found ${advertisers.length} advertisers for "${query}"`);
    return advertisers;
  } catch (err) {
    console.error("[TikTok] Advertiser search error:", err);
    return [];
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function tryTiktokApi(query: string): Promise<TiktokAdvertiserCandidate[]> {
  try {
    // TikTok Ad Library has a public API endpoint
    const url = `https://library.tiktok.com/api/v1/search?region=all&type=1&adv_name=${encodeURIComponent(query)}&page=1&page_size=10`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const advertisers: TiktokAdvertiserCandidate[] = [];
    extractTiktokAdvertisers(data, advertisers);

    console.error(`[TikTok] API found ${advertisers.length} advertisers`);
    return advertisers;
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTiktokAdvertisers(data: any, results: TiktokAdvertiserCandidate[]): void {
  if (!data || typeof data !== "object") return;

  // Look for advertiser objects with name + biz_id
  if (data.adv_name && data.biz_id) {
    if (!results.some(r => r.bizId === String(data.biz_id))) {
      results.push({ name: data.adv_name, bizId: String(data.biz_id) });
    }
    return;
  }

  // Check for advertiser_name/advertiser_id patterns
  if (data.advertiser_name && data.advertiser_id) {
    if (!results.some(r => r.bizId === String(data.advertiser_id))) {
      results.push({ name: data.advertiser_name, bizId: String(data.advertiser_id) });
    }
    return;
  }

  // Check for data.data.ads_list or similar nested arrays
  if (Array.isArray(data)) {
    for (const item of data) extractTiktokAdvertisers(item, results);
  } else {
    for (const value of Object.values(data)) {
      if (value && typeof value === "object") extractTiktokAdvertisers(value, results);
    }
  }
}
