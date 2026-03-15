"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";

interface AppEvent {
  name: string;
  description?: string;
  imageUrl?: string;
  badge?: string;
}

interface StoreListingData {
  title: string;
  subtitle?: string;
  description: string;
  screenshots: string[];
  video?: string;
  icon: string;
  developer: string;
  rating?: number;
  installs?: string;
  events?: AppEvent[];
}

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function toYouTubeEmbed(url: string): string {
  let videoId = "";
  if (url.includes("watch?v=")) {
    videoId = url.split("watch?v=")[1]?.split("&")[0] ?? "";
  } else if (url.includes("youtu.be/")) {
    videoId = url.split("youtu.be/")[1]?.split("?")[0] ?? "";
  } else if (url.includes("/embed/")) {
    return url; // Already an embed URL
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}

export function StoreListingView() {
  const { selectedAppId, selectedStore, selectedCountry, trackedApps } =
    useStore();
  const [listing, setListing] = useState<StoreListingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedApp = trackedApps.find((a) => a.id === selectedAppId);
  const appId =
    selectedStore === "appstore"
      ? selectedApp?.appStoreId
      : selectedApp?.playStoreId;

  const fetchListing = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    setExpanded(false);
    try {
      const res = await fetch(
        `/api/aso/store-listing?appId=${encodeURIComponent(appId)}&store=${selectedStore}&country=${selectedCountry}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setListing(data);
    } catch {
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [appId, selectedStore, selectedCountry]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  if (!appId) return null;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 card-shadow p-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#ec5b13] border-t-transparent" />
          <span className="text-sm text-slate-400">
            Loading store listing...
          </span>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 card-shadow overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">
            Store Listing Overview
          </h3>
          <div className="flex items-center gap-2">
            {listing.rating && (
              <span className="text-xs font-bold text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded">
                {listing.rating.toFixed(1)} stars
              </span>
            )}
            {listing.installs && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {listing.installs} installs
              </span>
            )}
          </div>
        </div>

        {/* Subtitle / Short description */}
        {listing.subtitle && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {listing.subtitle}
          </p>
        )}
      </div>

      {/* App Preview / Trailer video */}
      {listing.video && (
        <div className="px-6 pt-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {selectedStore === "appstore" ? "App Preview" : "Trailer"}
          </h4>
          {isYouTubeUrl(listing.video) ? (
            <iframe
              src={toYouTubeEmbed(listing.video)}
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full aspect-video rounded-xl bg-black"
            />
          ) : (
            <video
              src={listing.video}
              controls
              muted
              playsInline
              className="w-full max-h-64 rounded-xl bg-black object-contain"
            />
          )}
        </div>
      )}

      {/* Screenshots */}
      {listing.screenshots.length > 0 && (
        <div className="px-6 pt-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Screenshots
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {listing.screenshots.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Screenshot ${i + 1}`}
                className="h-52 rounded-xl flex-shrink-0 border border-slate-200 dark:border-slate-700"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {/* App Events */}
      {listing.events && listing.events.length > 0 && (
        <div className="px-6 pt-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Events
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {listing.events.map((event, i) => (
              <div
                key={i}
                className="min-w-[220px] max-w-[220px] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700"
              >
                {event.imageUrl && (
                  <img
                    src={event.imageUrl}
                    alt={event.name}
                    className="w-full h-28 object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-3">
                  {event.badge && (
                    <span className="text-[10px] font-bold text-[#ec5b13] bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded mb-1 inline-block">
                      {event.badge}
                    </span>
                  )}
                  <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                    {event.name}
                  </p>
                  {event.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div className="p-6">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Description
        </h4>
        <div className="relative">
          <p
            className={`text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line ${
              expanded ? "" : "line-clamp-4"
            }`}
          >
            {listing.description}
          </p>
          {listing.description.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-bold text-[#ec5b13] hover:underline mt-1"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
