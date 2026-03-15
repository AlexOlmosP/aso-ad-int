"use client";

import { useStore } from "@/lib/store";
import type { AdNetwork, AdCreative } from "@/lib/types";

const NETWORK_CONFIG: Record<
  AdNetwork,
  { label: string; color: string; icon: string }
> = {
  meta: { label: "Meta Ads", color: "#1877F2", icon: "M" },
  google: { label: "Google Ads", color: "#4285F4", icon: "G" },
  tiktok: { label: "TikTok Ads", color: "#000000", icon: "T" },
};

function AdCard({ ad }: { ad: AdCreative }) {
  const formatImpressions = (n?: number) => {
    if (!n) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return n.toString();
  };

  return (
    <div className="min-w-[280px] max-w-[280px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden card-shadow flex-shrink-0">
      {/* Image / Video / Preview */}
      <div className="h-48 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
        {ad.videoUrl ? (
          <video
            src={ad.videoUrl}
            poster={ad.imageUrl || undefined}
            controls
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : ad.imageUrl ? (
          <img
            src={ad.imageUrl}
            alt={ad.title ?? "Ad creative"}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-tighter">
          {ad.format}
        </div>
        {ad.isActive && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full font-bold">
            Active
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {ad.title && (
          <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
            {ad.title}
          </p>
        )}
        {ad.body && (
          <p className="text-xs text-slate-500 line-clamp-2">{ad.body}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase font-bold">
              Impr.
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {formatImpressions(ad.impressions)}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase font-bold">
              Started
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {ad.startDate
                ? new Date(ad.startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>

        {ad.advertiserName && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 truncate">
              {ad.advertiserName}
            </span>
            {ad.url && (
              <a
                href={ad.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#ec5b13] hover:underline"
              >
                View
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NetworkSection({ network }: { network: AdNetwork }) {
  const { ads, loading, fetchAds, selectedAppId } = useStore();
  const config = NETWORK_CONFIG[network];
  const networkAds = ads[network];
  const isLoading = loading.ads[network];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="size-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: config.color }}
          >
            {config.icon}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {config.label}
          </h3>
          {networkAds.length > 0 && (
            <span className="text-xs font-bold text-[#ec5b13] bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-800/30">
              {networkAds.length} creatives
            </span>
          )}
        </div>
        <button
          onClick={() => fetchAds(network)}
          disabled={isLoading || !selectedAppId}
          className="text-xs font-bold text-[#ec5b13] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#ec5b13] border-t-transparent" />
            <span className="text-sm text-slate-400">
              Fetching {config.label.toLowerCase()}...
            </span>
          </div>
        </div>
      ) : networkAds.length === 0 ? (
        <div className="py-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-400">
            No ads found. Click &quot;Fetch Ads&quot; above to search.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {networkAds.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>
      )}
    </section>
  );
}

export function AdIntelView() {
  const { fetchAllAds, selectedAppId, loading } = useStore();
  const anyLoading = Object.values(loading.ads).some(Boolean);

  return (
    <div className="space-y-8">
      {/* Fetch all button */}
      <div className="flex justify-end">
        <button
          onClick={fetchAllAds}
          disabled={anyLoading || !selectedAppId}
          className="px-6 py-2.5 bg-[#ec5b13] text-white text-sm font-bold rounded-xl premium-btn disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {anyLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Fetching Ads...
            </span>
          ) : (
            "Fetch All Ads"
          )}
        </button>
      </div>

      <NetworkSection network="meta" />
      <NetworkSection network="google" />
      <NetworkSection network="tiktok" />
    </div>
  );
}
