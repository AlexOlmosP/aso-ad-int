"use client";

import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";
import { AppSearchModal } from "./AppSearchModal";
import type { ActiveTool } from "@/lib/types";

const INTEL_ITEMS: { id: ActiveTool; label: string }[] = [
  { id: "intel-ads", label: "Ad Intelligence" },
  { id: "intel-revenue", label: "Revenue Estimates" },
  { id: "intel-retention", label: "Retention Estimates" },
];

const ASO_ITEMS: { id: ActiveTool; label: string }[] = [
  { id: "aso-keywords", label: "Tracked Keywords" },
  { id: "aso-rankings", label: "Keyword Rankings" },
  { id: "aso-suggestions", label: "Keyword Suggestions" },
  { id: "aso-audit", label: "ASO Audit" },
  { id: "aso-cro", label: "CR Optimization" },
];

function isIntelTool(tool: ActiveTool): boolean {
  return tool.startsWith("intel-");
}

function isAsoTool(tool: ActiveTool): boolean {
  return tool.startsWith("aso-");
}

export function Sidebar() {
  const {
    activeTool,
    setActiveTool,
    trackedApps,
    selectedAppId,
    setSelectedApp,
    removeTrackedApp,
  } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(isIntelTool(activeTool));
  const [asoOpen, setAsoOpen] = useState(isAsoTool(activeTool));
  const navRef = useRef<HTMLElement>(null);

  // Open folder when a tool in it is selected
  useEffect(() => {
    if (isIntelTool(activeTool)) setIntelOpen(true);
    if (isAsoTool(activeTool)) setAsoOpen(true);
  }, [activeTool]);

  // Staggered entrance for tracked apps
  useEffect(() => {
    if (!navRef.current || trackedApps.length === 0) return;
    gsap.fromTo(
      navRef.current.querySelectorAll(".app-item"),
      { opacity: 0, x: -12 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.04, ease: "power2.out" }
    );
  }, [trackedApps.length]);

  return (
    <>
      <aside className="w-64 bg-[#0f172a] text-white flex flex-col shrink-0 border-r border-white/[0.04]">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="size-10 bg-[#ec5b13] rounded-xl flex items-center justify-center glow-primary">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg heading-lg leading-none">Fair Ad Int & ASO</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
              Premium Suite
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-4 mb-4 space-y-1">
          {/* App Intelligence section */}
          <div>
            <button
              onClick={() => {
                setIntelOpen(!intelOpen);
                if (!isIntelTool(activeTool)) setActiveTool("intel-ads");
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                isIntelTool(activeTool)
                  ? "text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold flex-1">App Intelligence</span>
              <svg
                className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${intelOpen ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Intel sub-items */}
            {intelOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-3">
                {INTEL_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTool(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                      activeTool === item.id
                        ? "bg-white/[0.08] text-white shadow-[inset_2px_0_0_#ec5b13]"
                        : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                    }`}
                  >
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ASO Research section */}
          <div>
            <button
              onClick={() => {
                setAsoOpen(!asoOpen);
                if (!isAsoTool(activeTool)) setActiveTool("aso-keywords");
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                isAsoTool(activeTool)
                  ? "text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs font-semibold flex-1">ASO Research</span>
              <svg
                className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${asoOpen ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* ASO sub-items */}
            {asoOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-3">
                {ASO_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTool(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                      activeTool === item.id
                        ? "bg-white/[0.08] text-white shadow-[inset_2px_0_0_#ec5b13]"
                        : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                    }`}
                  >
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="px-4 mb-3">
          <div className="h-px bg-white/[0.06]" />
        </div>

        {/* Tracked apps list */}
        <nav ref={navRef} className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Tracked Apps
            </p>
            <button
              onClick={() => setSearchOpen(true)}
              className="size-5 flex items-center justify-center rounded-md bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {trackedApps.length === 0 && (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full px-3 py-4 rounded-xl border border-dashed border-slate-700/60 text-slate-500 text-xs hover:border-[#ec5b13]/40 hover:text-slate-300 transition-all hover:shadow-[0_0_15px_rgba(236,91,19,0.1)]"
            >
              + Add your first app
            </button>
          )}

          {trackedApps.map((app) => (
            <div
              key={app.id}
              className={`app-item group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                selectedAppId === app.id
                  ? "bg-white/[0.08] text-white shadow-[inset_3px_0_0_#ec5b13,0_0_15px_rgba(236,91,19,0.08)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
              onClick={() => setSelectedApp(app.id)}
            >
              {app.icon ? (
                <img
                  src={app.icon}
                  alt={app.name}
                  className="size-7 rounded-lg object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="size-7 bg-slate-700 rounded-lg flex items-center justify-center text-xs ring-1 ring-white/10">
                  {app.name[0]}
                </div>
              )}
              <span className="text-sm font-medium truncate flex-1">
                {app.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTrackedApp(app.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all scale-75 group-hover:scale-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {searchOpen && <AppSearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
