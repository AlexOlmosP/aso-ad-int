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

// ── ASO Analysis types ─────────────────────────────────────
export interface KeywordSuggestion {
  term: string;
  estimatedVolume: number;
  difficulty: "low" | "medium" | "high";
  source: "autocomplete" | "competitor" | "semantic" | "google-search";
}

export interface AsoAuditFactor {
  name: string;
  score: number;
  maxScore: number;
  tips: string[];
}

export interface AsoAuditResult {
  overallScore: number;
  factors: AsoAuditFactor[];
}

export interface CroSuggestion {
  element: string;
  priority: "high" | "medium" | "low";
  currentState: string;
  recommendation: string;
}

export interface DiscoveredKeyword {
  term: string;
  rank: number;
  estimatedVolume: number;
  source: "autocomplete" | "competitor" | "category";
}

export interface RevenueEstimate {
  monthlyRevenue: { low: number; mid: number; high: number };
  dailyRevenue: { low: number; mid: number; high: number };
  confidence: "high" | "medium" | "low";
  retention: {
    d1: number;   // 0-1 (e.g. 0.28 = 28%)
    d7: number;
    d30: number;
  };
  breakdown: {
    estimatedDownloads: { min: number; max: number };
    iapPriceRange: string | null;
    avgIapPrice: number;
    conversionRate: number;
    category: string;
    hasAds: boolean;
    iapRevenueShare: number;
    adRevenueShare: number;
  };
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
export type ActiveTool = "intel-ads" | "intel-revenue" | "intel-retention" | "aso-keywords" | "aso-suggestions" | "aso-audit" | "aso-cro" | "aso-rankings";

export interface AppState {
  activeTool: ActiveTool;
  trackedApps: TrackedApp[];
  selectedAppId: string | null;
  selectedStore: "appstore" | "playstore";
  selectedCountry: string;
  adFormat: AdFormat;
  keywords: Keyword[];
  keywordSuggestions: KeywordSuggestion[];
  asoAudit: AsoAuditResult | null;
  croSuggestions: CroSuggestion[];
  ads: Record<AdNetwork, AdCreative[]>;
  loading: {
    search: boolean;
    keywords: boolean;
    keywordSuggestions: boolean;
    asoAudit: boolean;
    croSuggestions: boolean;
    ads: Record<AdNetwork, boolean>;
  };
}
