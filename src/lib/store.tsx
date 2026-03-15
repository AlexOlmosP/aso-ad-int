"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  TrackedApp,
  AdvertiserIds,
  Keyword,
  AdCreative,
  AdNetwork,
  ActiveTool,
  AdFormat,
  AppSearchResult,
} from "./types";

interface StoreContextValue {
  // State
  activeTool: ActiveTool;
  trackedApps: TrackedApp[];
  selectedAppId: string | null;
  selectedStore: "appstore" | "playstore";
  selectedCountry: string;
  adFormat: AdFormat;
  adDateStart: string;
  adDateEnd: string;
  keywords: Keyword[];
  ads: Record<AdNetwork, AdCreative[]>;
  loading: {
    search: boolean;
    keywords: boolean;
    ads: Record<AdNetwork, boolean>;
  };

  // Actions
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedApp: (id: string) => void;
  setSelectedStore: (store: "appstore" | "playstore") => void;
  setSelectedCountry: (country: string) => void;
  setAdFormat: (format: AdFormat) => void;
  setAdDateStart: (date: string) => void;
  setAdDateEnd: (date: string) => void;
  addTrackedApp: (results: AppSearchResult[]) => void;
  removeTrackedApp: (id: string) => void;
  updateAdvertiserIds: (appId: string, ids: Partial<AdvertiserIds>) => void;
  addKeywords: (terms: string) => void;
  removeKeyword: (id: string) => void;
  fetchKeywordData: () => Promise<void>;
  fetchAds: (network: AdNetwork) => Promise<void>;
  fetchAllAds: () => Promise<void>;
  searchApps: (query: string) => Promise<AppSearchResult[]>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<ActiveTool>("ad-intel");
  const [trackedApps, setTrackedApps] = useState<TrackedApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<"appstore" | "playstore">("appstore");
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [adFormat, setAdFormat] = useState<AdFormat>("all");
  const [adDateStart, setAdDateStart] = useState("");
  const [adDateEnd, setAdDateEnd] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [ads, setAds] = useState<Record<AdNetwork, AdCreative[]>>({
    meta: [],
    google: [],
    tiktok: [],
  });
  const [loading, setLoading] = useState({
    search: false,
    keywords: false,
    ads: { meta: false, google: false, tiktok: false },
  });

  const selectedApp = trackedApps.find((a) => a.id === selectedAppId) ?? null;
  const appsLoadedFromServer = useRef(false);

  // ── Load tracked apps on mount ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tracked-apps");
        if (!res.ok) return;
        const data = await res.json();
        const saved: TrackedApp[] = data.apps ?? [];
        if (saved.length > 0) {
          setTrackedApps(saved);
          setSelectedAppId(saved[0].id);
        }
      } catch {
        // Server not available yet, ignore
      } finally {
        appsLoadedFromServer.current = true;
      }
    })();
  }, []);

  // ── Save tracked apps whenever they change ────────────────
  useEffect(() => {
    // Skip the initial render and the load from server
    if (!appsLoadedFromServer.current) return;
    fetch("/api/tracked-apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apps: trackedApps }),
    }).catch(() => {});
  }, [trackedApps]);

  // ── Load saved keywords when app changes ─────────────────
  useEffect(() => {
    if (!selectedAppId) {
      setKeywords([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/aso/saved-keywords?appId=${encodeURIComponent(selectedAppId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const saved: string[] = data.keywords ?? [];
        if (saved.length > 0) {
          setKeywords(
            saved.map((term) => ({
              id: `kw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              term,
              store: selectedStore,
              searchVolume: 0,
              relevant: false,
              appleSearchAds: false,
              rank: null,
            }))
          );
        } else {
          setKeywords([]);
        }
      } catch {
        setKeywords([]);
      }
    })();
  }, [selectedAppId, selectedStore]);

  // ── Save keywords whenever they change ───────────────────
  useEffect(() => {
    if (!selectedAppId) return;
    const terms = keywords.map((k) => k.term);
    fetch("/api/aso/saved-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: selectedAppId, keywords: terms }),
    }).catch(() => {});
  }, [keywords, selectedAppId]);

  const setSelectedApp = useCallback(
    (id: string) => {
      setSelectedAppId(id);
      setAds({ meta: [], google: [], tiktok: [] });
    },
    []
  );

  const addTrackedApp = useCallback((results: AppSearchResult[]) => {
    if (results.length === 0) return;

    const grouped = new Map<string, AppSearchResult[]>();
    for (const r of results) {
      const key = r.name.toLowerCase().trim();
      const existing = grouped.get(key) ?? [];
      existing.push(r);
      grouped.set(key, existing);
    }

    setTrackedApps((prev) => {
      const newApps: TrackedApp[] = [];
      for (const [, group] of grouped) {
        const first = group[0];
        const id = first.storeId;
        if (prev.some((a) => a.id === id)) continue;
        const stores = group.map((g) => g.store);
        newApps.push({
          id,
          name: first.name,
          icon: first.icon,
          developer: first.developer,
          appStoreId: group.find((g) => g.store === "appstore")?.storeId,
          playStoreId: group.find((g) => g.store === "playstore")?.storeId,
          category: first.category,
          stores: stores as ("appstore" | "playstore")[],
        });
      }

      const updated = [...prev, ...newApps];
      if (newApps.length > 0 && !prev.length) {
        setSelectedAppId(newApps[0].id);
      }
      return updated;
    });
  }, []);

  const removeTrackedApp = useCallback(
    (id: string) => {
      setTrackedApps((prev) => prev.filter((a) => a.id !== id));
      if (selectedAppId === id) {
        setSelectedAppId(null);
      }
    },
    [selectedAppId]
  );

  const updateAdvertiserIds = useCallback(
    (appId: string, ids: Partial<AdvertiserIds>) => {
      setTrackedApps((prev) =>
        prev.map((a) =>
          a.id === appId
            ? { ...a, advertiserIds: { ...a.advertiserIds, ...ids } }
            : a
        )
      );
    },
    []
  );

  // Accepts comma-separated keywords
  const addKeywords = useCallback((input: string) => {
    const terms = input
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (terms.length === 0) return;

    setKeywords((prev) => {
      const existing = new Set(prev.map((k) => k.term));
      const newKws = terms
        .filter((t) => !existing.has(t))
        .map((term) => ({
          id: `kw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          term,
          store: selectedStore,
          searchVolume: 0,
          relevant: false,
          appleSearchAds: false,
          rank: null,
        }));
      return [...prev, ...newKws];
    });
  }, [selectedStore]);

  const removeKeyword = useCallback((id: string) => {
    setKeywords((prev) => prev.filter((k) => k.id !== id));
  }, []);

  const searchApps = useCallback(
    async (query: string): Promise<AppSearchResult[]> => {
      setLoading((l) => ({ ...l, search: true }));
      try {
        const res = await fetch(
          `/api/search-apps?q=${encodeURIComponent(query)}&country=${selectedCountry}`
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        return data.results as AppSearchResult[];
      } finally {
        setLoading((l) => ({ ...l, search: false }));
      }
    },
    [selectedCountry]
  );

  const fetchKeywordData = useCallback(async () => {
    if (!selectedApp || keywords.length === 0) return;
    setLoading((l) => ({ ...l, keywords: true }));
    try {
      const res = await fetch("/api/aso/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: selectedStore === "appstore" ? selectedApp.appStoreId : selectedApp.playStoreId,
          store: selectedStore,
          keywords: keywords.map((k) => k.term),
          country: selectedCountry,
          appName: selectedApp.name,
          developer: selectedApp.developer,
        }),
      });
      if (!res.ok) throw new Error("Keyword fetch failed");
      const data = await res.json();
      setKeywords((prev) =>
        prev.map((kw) => {
          const match = data.keywords?.find(
            (d: Keyword) => d.term === kw.term
          );
          return match ? { ...kw, ...match, id: kw.id } : kw;
        })
      );
    } finally {
      setLoading((l) => ({ ...l, keywords: false }));
    }
  }, [selectedApp, selectedStore, keywords, selectedCountry]);

  const fetchAds = useCallback(
    async (network: AdNetwork) => {
      if (!selectedApp) return;
      setLoading((l) => ({
        ...l,
        ads: { ...l.ads, [network]: true },
      }));
      try {
        const res = await fetch("/api/ads/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            network,
            appName: selectedApp.name,
            developer: selectedApp.developer,
            country: selectedCountry,
            format: adFormat,
            startDate: adDateStart || undefined,
            endDate: adDateEnd || undefined,
            advertiserIds: selectedApp.advertiserIds,
          }),
        });
        if (!res.ok) throw new Error(`Failed to fetch ${network} ads`);
        const data = await res.json();
        setAds((prev) => ({ ...prev, [network]: data.ads ?? [] }));
      } finally {
        setLoading((l) => ({
          ...l,
          ads: { ...l.ads, [network]: false },
        }));
      }
    },
    [selectedApp, selectedCountry, adFormat, adDateStart, adDateEnd]
  );

  const fetchAllAds = useCallback(async () => {
    await Promise.allSettled([
      fetchAds("meta"),
      fetchAds("google"),
      fetchAds("tiktok"),
    ]);
  }, [fetchAds]);

  return (
    <StoreContext.Provider
      value={{
        activeTool,
        trackedApps,
        selectedAppId,
        selectedStore,
        selectedCountry,
        adFormat,
        adDateStart,
        adDateEnd,
        keywords,
        ads,
        loading,
        setActiveTool,
        setSelectedApp,
        setSelectedStore,
        setSelectedCountry,
        setAdFormat,
        setAdDateStart,
        setAdDateEnd,
        addTrackedApp,
        removeTrackedApp,
        updateAdvertiserIds,
        addKeywords,
        removeKeyword,
        fetchKeywordData,
        fetchAds,
        fetchAllAds,
        searchApps,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
