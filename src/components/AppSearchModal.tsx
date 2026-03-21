"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";
import type { AppSearchResult } from "@/lib/types";

export function AppSearchModal({ onClose }: { onClose: () => void }) {
  const { searchApps, addTrackedApp, loading } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AppSearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // GSAP entrance
  useEffect(() => {
    if (!modalRef.current) return;
    gsap.fromTo(modalRef.current,
      { scale: 0.95, opacity: 0, y: 10 },
      { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.5)" }
    );
  }, []);

  // Staggered results entrance
  useEffect(() => {
    if (!resultsRef.current || results.length === 0) return;
    gsap.fromTo(
      resultsRef.current.querySelectorAll(".search-result"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: "power2.out" }
    );
  }, [results.length]);

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

  // Group results by name
  const grouped = new Map<string, AppSearchResult[]>();
  for (const r of results) {
    const key = r.name.toLowerCase().trim();
    const existing = grouped.get(key) ?? [];
    existing.push(r);
    grouped.set(key, existing);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-white/95 dark:bg-slate-900/95 rounded-[2rem] shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col border border-slate-200/60 dark:border-white/[0.06] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100/80 dark:border-white/[0.04]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg heading-lg text-slate-900 dark:text-white">
              Search & Track Apps
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
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
              className="w-full pl-10 pr-4 py-3 bg-slate-50/80 dark:bg-white/[0.04] border border-transparent rounded-xl text-sm focus-glow text-slate-900 dark:text-white placeholder-slate-400"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="flex-1 overflow-y-auto p-4 space-y-2">
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
                className={`search-result p-3 rounded-xl border transition-all cursor-pointer ${
                  allSelected
                    ? "border-[#ec5b13]/40 bg-orange-50/80 dark:bg-orange-900/10 shadow-[0_0_15px_rgba(236,91,19,0.08)]"
                    : "border-slate-100/80 dark:border-white/[0.04] hover:border-slate-300 dark:hover:border-white/[0.1] hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                }`}
                onClick={() => {
                  if (hasMultipleStores) {
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
                    className="size-10 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10"
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
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                          r.store === "appstore"
                            ? "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-white/[0.06]"
                            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30"
                        }`}
                      >
                        {r.store === "appstore" ? "iOS" : "Android"}
                      </span>
                    ))}
                    {first.rating && (
                      <span className="text-[10px] text-slate-400 mono">
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
          <div className="p-4 border-t border-slate-100/80 dark:border-white/[0.04]">
            <button
              onClick={handleAdd}
              className="w-full py-3 bg-[#ec5b13] text-white font-semibold rounded-xl premium-btn transition-all"
            >
              Track {selected.size} app{selected.size > 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
