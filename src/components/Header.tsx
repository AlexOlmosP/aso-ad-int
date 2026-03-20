"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";
import { COUNTRIES } from "@/lib/countries";
import { AdvertiserIdPanel } from "./AdvertiserIdPanel";

export function Header() {
  const {
    trackedApps,
    selectedAppId,
    selectedStore,
    setSelectedStore,
    selectedCountry,
    setSelectedCountry,
    adFormat,
    setAdFormat,
    adDateStart,
    adDateEnd,
    setAdDateStart,
    setAdDateEnd,
    activeTool,
  } = useStore();

  const app = trackedApps.find((a) => a.id === selectedAppId);
  const pillRef = useRef<HTMLDivElement>(null);
  const appInfoRef = useRef<HTMLDivElement>(null);

  // Animated store switcher pill
  useEffect(() => {
    if (!pillRef.current) return;
    const offset = selectedStore === "appstore" ? 0 : 50;
    gsap.to(pillRef.current, {
      left: `${offset}%`,
      duration: 0.25,
      ease: "power2.out",
    });
  }, [selectedStore]);

  // App info entrance animation
  useEffect(() => {
    if (!appInfoRef.current || !app) return;
    gsap.fromTo(appInfoRef.current,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }
    );
  }, [selectedAppId, app]);

  return (
    <header className="min-h-16 glass-subtle border-b border-slate-200/60 dark:border-white/[0.04] flex items-center justify-between px-8 py-2 shrink-0 gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        {app ? (
          <div ref={appInfoRef} className="flex items-center gap-3">
            {app.icon ? (
              <img
                src={app.icon}
                alt={app.name}
                className="size-10 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10"
              />
            ) : (
              <div className="size-10 bg-[#ec5b13] rounded-xl flex items-center justify-center text-white font-bold glow-primary">
                {app.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-lg heading-lg leading-none text-slate-900 dark:text-white">
                {app.name}
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                {app.developer}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="size-10 bg-slate-100 dark:bg-white/[0.06] rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg heading-lg leading-none text-slate-400">
                Select an app
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                Add apps from the sidebar
              </p>
            </div>
          </div>
        )}

        {/* Advertiser IDs button (only in Ad Intel mode) */}
        {app && activeTool === "ad-intel" && <AdvertiserIdPanel />}

        {/* Store switcher with animated pill */}
        <div className="relative flex bg-slate-100/80 dark:bg-white/[0.06] p-1 rounded-lg ml-4">
          <div
            ref={pillRef}
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-white/[0.12] rounded-md shadow-sm pointer-events-none transition-none"
            style={{ left: selectedStore === "appstore" ? "4px" : "50%" }}
          />
          <button
            onClick={() => setSelectedStore("appstore")}
            className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
              selectedStore === "appstore"
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            App Store
          </button>
          <button
            onClick={() => setSelectedStore("playstore")}
            className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
              selectedStore === "playstore"
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 010 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
            </svg>
            Google Play
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Ad format selector (only in Ad Intel mode) */}
        {activeTool === "ad-intel" && (
          <>
            <select
              value={adFormat}
              onChange={(e) => setAdFormat(e.target.value as typeof adFormat)}
              className="appearance-none px-4 py-2 bg-slate-100/80 dark:bg-white/[0.06] border border-transparent rounded-xl text-sm font-medium focus-glow cursor-pointer text-slate-900 dark:text-white"
            >
              <option value="all">All Formats</option>
              <option value="video">Video</option>
              <option value="image">Image</option>
              <option value="carousel">Carousel</option>
              <option value="playable">Playable</option>
            </select>

            {/* Date range filter */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-white/[0.06] rounded-xl px-3 py-1.5 border border-transparent">
              {[7, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - days);
                    setAdDateStart(start.toISOString().split("T")[0]);
                    setAdDateEnd(end.toISOString().split("T")[0]);
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-[#ec5b13] px-1.5 py-0.5 rounded transition-colors"
                >
                  {days}d
                </button>
              ))}
              <span className="text-slate-300 dark:text-slate-600 mx-0.5">|</span>
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={adDateStart}
                onChange={(e) => setAdDateStart(e.target.value)}
                className="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none w-28"
                placeholder="Start"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={adDateEnd}
                onChange={(e) => setAdDateEnd(e.target.value)}
                className="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none w-28"
                placeholder="End"
              />
              {(adDateStart || adDateEnd) && (
                <button
                  onClick={() => { setAdDateStart(""); setAdDateEnd(""); }}
                  className="text-slate-400 hover:text-red-400 ml-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}

        {/* Country selector */}
        <div className="relative">
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="appearance-none pl-9 pr-8 py-2 bg-slate-100/80 dark:bg-white/[0.06] border border-transparent rounded-xl text-sm font-medium focus-glow cursor-pointer w-44 text-slate-900 dark:text-white"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </header>
  );
}
