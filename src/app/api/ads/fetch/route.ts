import { NextRequest, NextResponse } from "next/server";
import type { AdCreative, AdNetwork, AdvertiserIds } from "@/lib/types";
import { scrapeMetaAds } from "@/lib/scrapers/meta";
import { scrapeGoogleAds } from "@/lib/scrapers/google";

// Map app format filter to Meta Ad Library media_type param
function toMetaMediaType(format: string): string {
  switch (format) {
    case "video": return "video";
    case "image": return "image";
    default: return "all";
  }
}

function filterByDate(ads: AdCreative[], startDate?: string, endDate?: string): AdCreative[] {
  const start = startDate ? new Date(startDate).getTime() : 0;
  const end = endDate ? new Date(endDate).getTime() : Infinity;

  return ads.filter((ad) => {
    const adStart = ad.startDate ? new Date(ad.startDate).getTime() : 0;
    const adEnd = ad.endDate ? new Date(ad.endDate).getTime() : Infinity;
    return adStart <= end && adEnd >= start;
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { network, appName, developer, country, format, startDate, endDate, advertiserIds } = body as {
    network: AdNetwork;
    appName: string;
    developer: string;
    country: string;
    format: string;
    startDate?: string;
    endDate?: string;
    advertiserIds?: AdvertiserIds;
  };

  console.log(`[API] Request: network=${network}, appName="${appName}", advertiserIds=`, JSON.stringify(advertiserIds));

  let ads: AdCreative[] = [];

  try {
    switch (network) {
      case "meta": {
        if (!advertiserIds?.metaPageId) {
          console.log("[Meta] No Meta Page ID provided");
          break;
        }
        // Pass actual country and mediaType to Meta's Ad Library URL
        // (the URL sorts by total_impressions, so first results = top impressions)
        const metaMediaType = toMetaMediaType(format);
        ads = await scrapeMetaAds({
          metaPageId: advertiserIds.metaPageId,
          country: country || "ALL",
          mediaType: metaMediaType,
          limit: 10,
        });
        if (startDate || endDate) ads = filterByDate(ads, startDate, endDate);
        ads = ads.slice(0, 5);
        break;
      }
      case "google": {
        if (!advertiserIds?.googleAdId) {
          console.log("[Google] No Google Ad ID provided");
          break;
        }
        ads = await scrapeGoogleAds({
          googleAdId: advertiserIds.googleAdId,
          limit: 5,
        });
        break;
      }
      case "tiktok":
        console.log("[TikTok] Scraping disabled — will be added later");
        break;
    }
  } catch (err) {
    console.error(`Error fetching ${network} ads:`, err);
  }

  // Post-scrape format filter: enforce client-side since scraper may return mixed formats
  if (format && format !== "all") {
    ads = ads.filter(ad => ad.format === format);
  }

  ads.sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));

  // Suppress unused variable warnings for params used by future TikTok implementation
  void appName; void developer; void country;

  return NextResponse.json({ ads });
}
