"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";

export function KeywordSuggestions() {
  const { keywordSuggestions, loading, fetchKeywordSuggestions, selectedAppId, addKeywords } = useStore();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current || keywordSuggestions.length === 0) return;
    gsap.fromTo(
      listRef.current.querySelectorAll(".kw-row"),
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.3, stagger: 0.03, ease: "power2.out" }
    );
  }, [keywordSuggestions.length]);

  const difficultyColor = (d: string) => {
    if (d === "low") return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30";
    if (d === "medium") return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30";
    return "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30";
  };

  const sourceColor = (s: string) => {
    if (s === "autocomplete") return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30";
    if (s === "competitor") return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30";
    if (s === "google-search") return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30";
    return "text-slate-500 bg-slate-50 dark:bg-white/[0.04] border-slate-200/60 dark:border-white/[0.06]";
  };

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] border border-slate-200/60 dark:border-white/[0.06] card-shadow overflow-hidden backdrop-blur-sm">
      <div className="p-5 border-b border-slate-100/80 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="heading-lg text-lg text-slate-900 dark:text-white">Keyword Suggestions</h3>
            <p className="text-xs text-slate-400 mt-1">Keywords not currently in your app&apos;s on-metadata</p>
          </div>
          <button
            onClick={fetchKeywordSuggestions}
            disabled={loading.keywordSuggestions || !selectedAppId}
            className="px-5 py-2.5 bg-[#ec5b13] text-white text-xs font-bold rounded-xl premium-btn disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading.keywordSuggestions ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Analyzing...
              </span>
            ) : "Get Suggestions"}
          </button>
        </div>
      </div>

      <div ref={listRef} className="overflow-y-auto max-h-[600px]">
        {loading.keywordSuggestions ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="h-10 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : keywordSuggestions.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">
            Discover high-potential keywords not yet in your app&apos;s metadata
          </p>
        ) : (
          <>
            {/* Table header */}
            <div className="sticky top-0 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-100/80 dark:border-white/[0.04] px-5 py-2.5 flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="w-6 text-right shrink-0">#</span>
              <span className="flex-1">Keyword</span>
              <span className="w-20 text-center">Volume</span>
              <span className="w-20 text-center">Difficulty</span>
              <span className="w-20 text-center">Source</span>
              <span className="w-12 shrink-0" />
            </div>

            {/* Table rows */}
            <div className="divide-y divide-slate-100/60 dark:divide-white/[0.03]">
              {keywordSuggestions.map((kw, i) => (
                <div key={kw.term} className="kw-row flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group">
                  <span className="text-[10px] font-bold mono text-slate-400 w-6 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{kw.term}</p>
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

                  {/* Difficulty */}
                  <div className="w-20 flex justify-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${difficultyColor(kw.difficulty)}`}>
                      {kw.difficulty}
                    </span>
                  </div>

                  {/* Source */}
                  <div className="w-20 flex justify-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sourceColor(kw.source)}`}>
                      {kw.source === "google-search" ? "google" : kw.source}
                    </span>
                  </div>

                  {/* Add button */}
                  <button
                    onClick={() => addKeywords(kw.term)}
                    className="w-12 shrink-0 opacity-0 group-hover:opacity-100 text-[10px] font-bold text-[#ec5b13] hover:underline transition-opacity text-center"
                  >
                    + Add
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
