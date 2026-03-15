"use client";

import { useState, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { AppSearchResult } from "@/lib/types";

export function AppSearchModal({ onClose }: { onClose: () => void }) {
  const { searchApps, addTrackedApp, loading } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AppSearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        const res = await searchApps(q);
        setResults(res);
      }, 400);
    },
    [searchApps]
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const selectedResults = results.filter((r) => selected.has(r.id));
    addTrackedApp(selectedResults);
    onClose();
  };

  // Group results by name for clustering
  const grouped = new Map<string, AppSearchResult[]>();
  for (const r of results) {
    const key = r.name.toLowerCase().trim();
    const existing = grouped.get(key) ?? [];
    existing.push(r);
    grouped.set(key, existing);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Search & Track Apps
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search apps across App Store & Google Play..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ec5b13] text-slate-900 dark:text-white placeholder-slate-400"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading.search && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#ec5b13] border-t-transparent" />
            </div>
          )}

          {!loading.search && results.length === 0 && query.trim() && (
            <p className="text-center text-sm text-slate-400 py-8">
              No apps found. Try a different search.
            </p>
          )}

          {[...grouped.entries()].map(([, group]) => {
            const hasMultipleStores = group.length > 1;
            const allSelected = group.every((r) => selected.has(r.id));
            const first = group[0];

            return (
              <div
                key={first.id}
                className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                  allSelected
                    ? "border-[#ec5b13] bg-orange-50 dark:bg-orange-900/10"
                    : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
                onClick={() => {
                  if (hasMultipleStores) {
                    // Toggle all in cluster
                    const shouldSelect = !allSelected;
                    for (const r of group) {
                      if (shouldSelect && !selected.has(r.id)) toggleSelect(r.id);
                      if (!shouldSelect && selected.has(r.id)) toggleSelect(r.id);
                    }
                  } else {
                    toggleSelect(first.id);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={first.icon}
                    alt={first.name}
                    className="size-10 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {first.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {first.developer}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {group.map((r) => (
                      <span
                        key={r.id}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          r.store === "appstore"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        }`}
                      >
                        {r.store === "appstore" ? "iOS" : "Android"}
                      </span>
                    ))}
                    {first.rating && (
                      <span className="text-[10px] text-slate-400">
                        {first.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {selected.size > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleAdd}
              className="w-full py-3 bg-[#ec5b13] text-white font-semibold rounded-xl premium-btn hover:opacity-90 transition-opacity"
            >
              Track {selected.size} app{selected.size > 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
