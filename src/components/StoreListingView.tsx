"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import gsap from "gsap";
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
    return url;
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}

export function StoreListingView() {
  const { selectedAppId, selectedStore, selectedCountry, trackedApps } =
    useStore();
  const [listing, setListing] = useState<StoreListingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const screenshotsRef = useRef<HTMLDivElement>(null);

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

  // Screenshot staggered entrance
  useEffect(() => {
    if (!screenshotsRef.current || !listing?.screenshots.length) return;
    gsap.fromTo(
      screenshotsRef.current.querySelectorAll("img"),
      { opacity: 0, scale: 0.95, y: 8 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, stagger: 0.05, ease: "power2.out" }
    );
  }, [listing?.screenshots.length]);

  if (!appId) return null;

  if (loading) {
    return (
      <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] card-shadow p-8 backdrop-blur-sm">
        <div className="space-y-4">
          <div className="h-6 w-48 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-72 rounded skeleton-shimmer" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 w-28 rounded-xl skeleton-shimmer flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <section ref={sectionRef} className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] card-shadow overflow-hidden backdrop-blur-sm">
      <div className="p-6 border-b border-slate-100/80 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <h3 className="heading-lg text-lg text-slate-900 dark:text-white">
            Store Listing Overview
          </h3>
          <div className="flex items-center gap-2">
            {listing.rating && (
              <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-1 rounded-lg border border-yellow-100 dark:border-yellow-800/30">
                {listing.rating.toFixed(1)} stars
              </span>
            )}
            {listing.installs && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100/80 dark:bg-white/[0.06] px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-white/[0.04] mono">
                {listing.installs} installs
              </span>
            )}
          </div>
        </div>

        {listing.subtitle && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {listing.subtitle}
          </p>
        )}
      </div>

      {/* App Preview / Trailer video */}
      {listing.video && (
        <div className="px-6 pt-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {selectedStore === "appstore" ? "App Preview" : "Trailer"}
          </h4>
          <div className="rounded-xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
            {isYouTubeUrl(listing.video) ? (
              <iframe
                src={toYouTubeEmbed(listing.video)}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full aspect-video bg-black"
              />
            ) : (
              <video
                src={listing.video}
                controls
                muted
                playsInline
                className="w-full max-h-64 bg-black object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* Screenshots */}
      {listing.screenshots.length > 0 && (
        <div className="px-6 pt-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Screenshots
          </h4>
          <div ref={screenshotsRef} className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-fade-right">
            {listing.screenshots.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Screenshot ${i + 1}`}
                className="h-52 rounded-xl flex-shrink-0 border border-slate-200/60 dark:border-white/[0.06] hover:scale-[1.02] transition-transform cursor-pointer"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {/* App Events */}
      {listing.events && listing.events.length > 0 && (
        <div className="px-6 pt-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Events
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-fade-right">
            {listing.events.map((event, i) => (
              <div
                key={i}
                className="min-w-[220px] max-w-[220px] bg-white/60 dark:bg-white/[0.03] rounded-xl overflow-hidden flex-shrink-0 border border-slate-200/60 dark:border-white/[0.06] card-shadow-hover"
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
                    <span className="text-[10px] font-bold text-[#ec5b13] bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-md mb-1 inline-block border border-orange-100 dark:border-orange-800/30">
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
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
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
