"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";

export function KeywordRankings() {
  const { discoveredKeywords, loading, fetchDiscoveredKeywords, selectedAppId, addKeywords } = useStore();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current || discoveredKeywords.length === 0) return;
    gsap.fromTo(
      listRef.current.querySelectorAll(".kw-row"),
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.3, stagger: 0.03, ease: "power2.out" }
    );
  }, [discoveredKeywords.length]);

  const rankColor = (rank: number) => {
    if (rank <= 3) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20";
    if (rank <= 10) return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";
    if (rank <= 30) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20";
    return "text-slate-500 bg-slate-50 dark:bg-white/[0.04]";
  };

  const sourceColor = (s: string) => {
    if (s === "autocomplete") return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30";
    if (s === "competitor") return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30";
    if (s === "category") return "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800/30";
    return "text-slate-500 bg-slate-50 dark:bg-white/[0.04] border-slate-200/60 dark:border-white/[0.06]";
  };

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] border border-slate-200/60 dark:border-white/[0.06] card-shadow overflow-hidden backdrop-blur-sm">
      <div className="p-5 border-b border-slate-100/80 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="heading-lg text-lg text-slate-900 dark:text-white">Keyword Rankings</h3>
            <p className="text-xs text-slate-400 mt-1">
              Keywords your app ranks for in the top 100
              {discoveredKeywords.length > 0 && (
                <span className="ml-2 text-[#ec5b13] font-bold">{discoveredKeywords.length} found</span>
              )}
            </p>
          </div>
          <button
            onClick={fetchDiscoveredKeywords}
            disabled={loading.discoveredKeywords || !selectedAppId}
            className="px-5 py-2.5 bg-[#ec5b13] text-white text-xs font-bold rounded-xl premium-btn disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading.discoveredKeywords ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Discovering...
              </span>
            ) : "Discover Keywords"}
          </button>
        </div>
      </div>

      <div ref={listRef} className="overflow-y-auto max-h-[600px]">
        {loading.discoveredKeywords ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <div key={i} className="h-10 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : discoveredKeywords.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">
            Discover all keywords your app currently ranks for in the store
          </p>
        ) : (
          <>
            {/* Table header */}
            <div className="sticky top-0 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-100/80 dark:border-white/[0.04] px-5 py-2.5 flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="w-6 text-right shrink-0">#</span>
              <span className="flex-1">Keyword</span>
              <span className="w-16 text-center">Rank</span>
              <span className="w-20 text-center">Volume</span>
              <span className="w-20 text-center">Source</span>
              <span className="w-14 shrink-0" />
            </div>

            {/* Table rows */}
            <div className="divide-y divide-slate-100/60 dark:divide-white/[0.03]">
              {discoveredKeywords.map((kw, i) => (
                <div key={kw.term} className="kw-row flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group">
                  <span className="text-[10px] font-bold mono text-slate-400 w-6 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{kw.term}</p>
                  </div>

                  {/* Rank */}
                  <div className="w-16 flex justify-center">
                    <span className={`text-xs font-bold mono px-2.5 py-0.5 rounded-lg ${rankColor(kw.rank)}`}>
                      #{kw.rank}
                    </span>
                  </div>

                  {/* Volume */}
                  <div className="w-20 flex items-center justify-center gap-1.5">
                    <div className="w-10 h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ec5b13] rounded-full"
                        style={{ width: `${kw.estimatedVolume}%` }}
                      />
                    </div>
                    <span className="text-[11px] mono font-bold text-slate-600 dark:text-slate-300 w-6 text-right">
                      {kw.estimatedVolume}
                    </span>
                  </div>

                  {/* Source */}
                  <div className="w-20 flex justify-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sourceColor(kw.source)}`}>
                      {kw.source}
                    </span>
                  </div>

                  {/* Track button */}
                  <button
                    onClick={() => addKeywords(kw.term)}
                    className="w-14 shrink-0 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-[#ec5b13] hover:underline transition-opacity text-center"
                  >
                    + Track
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
