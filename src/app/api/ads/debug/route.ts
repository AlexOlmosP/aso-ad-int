import { NextRequest, NextResponse } from "next/server";
import { scrapeMetaAds } from "@/lib/scrapers/meta";
import { scrapeGoogleAds } from "@/lib/scrapers/google";
import { createPage } from "@/lib/scrapers/browser";
import type { BrowserContext } from "playwright-core";

/**
 * Raw Google Ads Transparency RPC dump.
 * Navigates to the transparency page, intercepts ALL SearchCreatives RPC
 * responses, and returns the full parsed JSON with no mapping applied.
 */
async function scrapeGoogleRaw(advertiserId: string) {
  let context: BrowserContext | null = null;
  const url = `https://adstransparency.google.com/advertiser/${advertiserId}?region=anywhere&format=VIDEO`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interceptedResponses: { url: string; data: any }[] = [];
  let totalResponses = 0;

  try {
    const { context: ctx, page } = await createPage();
    context = ctx;

    page.on("response", async (response) => {
      try {
        totalResponses++;
        const resUrl = response.url();

        if (resUrl.includes("SearchCreatives") || resUrl.includes("SearchService")) {
          const text = await response.text();
          const cleanText = text.replace(/^\)\]\}'\n?/, "");
          try {
            const parsed = JSON.parse(cleanText);
            interceptedResponses.push({ url: resUrl, data: parsed });
          } catch {
            // If JSON parse fails, store the raw text
            interceptedResponses.push({ url: resUrl, data: { _rawText: cleanText.substring(0, 5000) } });
          }
        }
      } catch {
        // Skip responses that can't be read
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);

    return {
      navigatedTo: url,
      totalResponsesIntercepted: totalResponses,
      searchCreativeResponses: interceptedResponses.length,
      responses: interceptedResponses,
    };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

export async function GET(req: NextRequest) {
  const rawParam = req.nextUrl.searchParams.get("raw");

  // --- Raw Google RPC dump mode ---
  if (rawParam === "google") {
    const advertiserId = req.nextUrl.searchParams.get("google") || "AR05127249288434286593";
    const start = Date.now();
    try {
      const rawData = await scrapeGoogleRaw(advertiserId);
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - start}ms`,
        advertiserId,
        ...rawData,
      });
    } catch (err) {
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - start}ms`,
        error: String(err),
      }, { status: 500 });
    }
  }

  // --- Normal debug mode ---
  const metaPageId = req.nextUrl.searchParams.get("meta") || "58755926184";
  const googleAdId = req.nextUrl.searchParams.get("google") || "AR05127249288434286593";
  const network = req.nextUrl.searchParams.get("network") || "both";

  const results: Record<string, unknown> = { timestamp: new Date().toISOString() };

  if (network === "meta" || network === "both") {
    const start = Date.now();
    const metaAds = await scrapeMetaAds({
      metaPageId,
      country: "ALL",
      mediaType: "all",
      limit: 3,
    });
    results.meta = {
      duration: `${Date.now() - start}ms`,
      count: metaAds.length,
      ads: metaAds,
    };
  }

  if (network === "google" || network === "both") {
    const start = Date.now();
    const googleAds = await scrapeGoogleAds({
      googleAdId,
      limit: 3,
    });
    results.google = {
      duration: `${Date.now() - start}ms`,
      count: googleAds.length,
      ads: googleAds,
    };
  }

  return NextResponse.json(results);
}
