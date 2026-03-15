"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AppSearchModal } from "./AppSearchModal";

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

  return (
    <>
      <aside className="w-64 bg-[#0f172a] text-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="size-10 bg-[#ec5b13] rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Fair Ad Int & ASO</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
              Premium Suite
            </p>
          </div>
        </div>

        {/* Tool switcher */}
        <div className="px-4 mb-6">
          <div className="flex p-1 bg-slate-800/50 rounded-lg">
            <button
              onClick={() => setActiveTool("ad-intel")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTool === "ad-intel"
                  ? "bg-[#ec5b13] text-white premium-btn"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Ad Intel
            </button>
            <button
              onClick={() => setActiveTool("aso")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTool === "aso"
                  ? "bg-[#ec5b13] text-white premium-btn"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ASO Research
            </button>
          </div>
        </div>

        {/* Tracked apps list */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Tracked Apps
            </p>
            <button
              onClick={() => setSearchOpen(true)}
              className="size-5 flex items-center justify-center rounded-md bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {trackedApps.length === 0 && (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full px-3 py-4 rounded-xl border border-dashed border-slate-700 text-slate-500 text-xs hover:border-slate-500 hover:text-slate-300 transition-colors"
            >
              + Add your first app
            </button>
          )}

          {trackedApps.map((app) => (
            <div
              key={app.id}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                selectedAppId === app.id
                  ? "bg-slate-800 text-white border-l-4 border-[#ec5b13]"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
              onClick={() => setSelectedApp(app.id)}
            >
              {app.icon ? (
                <img
                  src={app.icon}
                  alt={app.name}
                  className="size-7 rounded-lg object-cover"
                />
              ) : (
                <div className="size-7 bg-slate-700 rounded-lg flex items-center justify-center text-xs">
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
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
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
