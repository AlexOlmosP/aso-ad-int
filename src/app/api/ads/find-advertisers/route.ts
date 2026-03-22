import { NextRequest, NextResponse } from "next/server";
import { searchMetaAdvertisers } from "@/lib/scrapers/meta";
import { searchGoogleAdvertisers } from "@/lib/scrapers/google";
import { searchTiktokAdvertisers } from "@/lib/scrapers/tiktok";

interface AdvertiserCandidate {
  name: string;
  id: string;
  confidence: "high" | "medium" | "low";
}

function scoreConfidence(
  advertiserName: string,
  appName: string,
  developer: string
): "high" | "medium" | "low" {
  const advLower = advertiserName.toLowerCase();
  const appLower = appName.toLowerCase();
  const devLower = developer.toLowerCase();

  // High: advertiser name contains app name or vice versa
  if (advLower.includes(appLower) || appLower.includes(advLower)) return "high";

  // High: advertiser name matches developer name closely
  if (advLower.includes(devLower) || devLower.includes(advLower)) return "high";

  // Medium: significant word overlap
  const advWords = advLower.split(/\s+/).filter(w => w.length >= 3);
  const appWords = appLower.split(/\s+/).filter(w => w.length >= 3);
  const devWords = devLower.split(/\s+/).filter(w => w.length >= 3);

  const hasAppWordOverlap = advWords.some(w => appWords.includes(w));
  const hasDevWordOverlap = advWords.some(w => devWords.includes(w));

  if (hasAppWordOverlap || hasDevWordOverlap) return "medium";

  return "low";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appName, developer } = body as {
      appName: string;
      developer: string;
    };

    if (!appName) {
      return NextResponse.json({ error: "Missing appName" }, { status: 400 });
    }

    // Search all 3 networks in parallel, using both app name and developer name
    const [
      metaByApp, metaByDev,
      googleByApp, googleByDev,
      tiktokByApp, tiktokByDev,
    ] = await Promise.allSettled([
      searchMetaAdvertisers(appName),
      developer ? searchMetaAdvertisers(developer) : Promise.resolve([]),
      searchGoogleAdvertisers(appName),
      developer ? searchGoogleAdvertisers(developer) : Promise.resolve([]),
      searchTiktokAdvertisers(appName),
      developer ? searchTiktokAdvertisers(developer) : Promise.resolve([]),
    ]);

    // Merge and deduplicate Meta results
    const metaRaw = [
      ...(metaByApp.status === "fulfilled" ? metaByApp.value : []),
      ...(metaByDev.status === "fulfilled" ? metaByDev.value : []),
    ];
    const metaSeen = new Set<string>();
    const meta: AdvertiserCandidate[] = [];
    for (const m of metaRaw) {
      if (metaSeen.has(m.pageId)) continue;
      metaSeen.add(m.pageId);
      meta.push({
        name: m.name,
        id: m.pageId,
        confidence: scoreConfidence(m.name, appName, developer || ""),
      });
    }

    // Merge and deduplicate Google results
    const googleRaw = [
      ...(googleByApp.status === "fulfilled" ? googleByApp.value : []),
      ...(googleByDev.status === "fulfilled" ? googleByDev.value : []),
    ];
    const googleSeen = new Set<string>();
    const google: AdvertiserCandidate[] = [];
    for (const g of googleRaw) {
      if (googleSeen.has(g.arId)) continue;
      googleSeen.add(g.arId);
      google.push({
        name: g.name,
        id: g.arId,
        confidence: scoreConfidence(g.name, appName, developer || ""),
      });
    }

    // Merge and deduplicate TikTok results
    const tiktokRaw = [
      ...(tiktokByApp.status === "fulfilled" ? tiktokByApp.value : []),
      ...(tiktokByDev.status === "fulfilled" ? tiktokByDev.value : []),
    ];
    const tiktokSeen = new Set<string>();
    const tiktok: AdvertiserCandidate[] = [];
    for (const t of tiktokRaw) {
      if (tiktokSeen.has(t.bizId)) continue;
      tiktokSeen.add(t.bizId);
      tiktok.push({
        name: t.name,
        id: t.bizId,
        confidence: scoreConfidence(t.name, appName, developer || ""),
      });
    }

    // Sort each by confidence (high first)
    const order = { high: 0, medium: 1, low: 2 };
    meta.sort((a, b) => order[a.confidence] - order[b.confidence]);
    google.sort((a, b) => order[a.confidence] - order[b.confidence]);
    tiktok.sort((a, b) => order[a.confidence] - order[b.confidence]);

    return NextResponse.json({ meta, google, tiktok });
  } catch (err) {
    console.error("[FindAdvertisers] Error:", err);
    return NextResponse.json(
      { error: "Failed to search advertiser libraries" },
      { status: 500 }
    );
  }
}
