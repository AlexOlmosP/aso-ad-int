// ── App types ──────────────────────────────────────────────
export interface AdvertiserIds {
  metaPageId?: string;       // Facebook Page ID (numeric, e.g. "123456789012345")
  googleAdId?: string;       // Google AR ID (e.g. "AR17828074650563772417")
  tiktokBizId?: string;      // TikTok Advertiser Biz ID (18-19 digits)
}

export interface TrackedApp {
  id: string;
  name: string;
  icon?: string;
  developer: string;
  appStoreId?: string;   // e.g. "com.example.app" or numeric id
  playStoreId?: string;  // e.g. "com.example.app"
  category?: string;
  stores: ("appstore" | "playstore")[];
  advertiserIds?: AdvertiserIds;
}

// ── ASO types ──────────────────────────────────────────────
export interface Keyword {
  id: string;
  term: string;
  store: "appstore" | "playstore";
  searchVolume: number;       // 1-100
  relevant: boolean;          // is it in app metadata?
  appleSearchAds: boolean;    // are competitors running ASA?
  rank: number | null;        // position in search results (null = not in top 100)
}

// ── Ad Intelligence types ──────────────────────────────────
export type AdNetwork = "meta" | "google" | "tiktok";

export type AdFormat = "all" | "video" | "image" | "carousel" | "playable";

export interface AdCreative {
  id: string;
  network: AdNetwork;
  title?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  previewUrl?: string;  // JS-based ad preview embed URL (Google content.js)
  format: string;
  impressions?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  url?: string;
  ctr?: string;
  advertiserName?: string;
}

// ── Search results ─────────────────────────────────────────
export interface AppSearchResult {
  id: string;
  name: string;
  icon: string;
  developer: string;
  store: "appstore" | "playstore";
  storeId: string;
  category?: string;
  rating?: number;
}

// ── Store state ────────────────────────────────────────────
export type ActiveTool = "ad-intel" | "aso";

export interface AppState {
  activeTool: ActiveTool;
  trackedApps: TrackedApp[];
  selectedAppId: string | null;
  selectedStore: "appstore" | "playstore";
  selectedCountry: string;
  adFormat: AdFormat;
  keywords: Keyword[];
  ads: Record<AdNetwork, AdCreative[]>;
  loading: {
    search: boolean;
    keywords: boolean;
    ads: Record<AdNetwork, boolean>;
  };
}
