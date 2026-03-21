"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";

function priorityStyle(p: string) {
  if (p === "high") return {
    badge: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30",
    accent: "border-l-red-500",
  };
  if (p === "medium") return {
    badge: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30",
    accent: "border-l-amber-500",
  };
  return {
    badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30",
    accent: "border-l-emerald-500",
  };
}

export function CroSuggestions() {
  const { croSuggestions, loading, fetchCroSuggestions, selectedAppId } = useStore();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current || croSuggestions.length === 0) return;
    gsap.fromTo(
      listRef.current.querySelectorAll(".cro-card"),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: "power2.out" }
    );
  }, [croSuggestions.length]);

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] border border-slate-200/60 dark:border-white/[0.06] card-shadow overflow-hidden backdrop-blur-sm flex flex-col">
      <div className="p-5 border-b border-slate-100/80 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="heading-lg text-lg text-slate-900 dark:text-white">CR Optimization</h3>
            <p className="text-xs text-slate-400 mt-1">Actionable tips to improve your conversion rate</p>
          </div>
          <button
            onClick={fetchCroSuggestions}
            disabled={loading.croSuggestions || !selectedAppId}
            className="px-5 py-2.5 bg-[#ec5b13] text-white text-xs font-bold rounded-xl premium-btn disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading.croSuggestions ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Analyzing...
              </span>
            ) : "Analyze CR"}
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4">
        {loading.croSuggestions ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : croSuggestions.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">
            Get actionable tips to improve your conversion rate
          </p>
        ) : (
          <div className="space-y-3">
            {croSuggestions.map((s, i) => {
              const ps = priorityStyle(s.priority);
              return (
                <div
                  key={i}
                  className={`cro-card p-3 rounded-xl border-l-[3px] ${ps.accent} bg-slate-50/60 dark:bg-white/[0.02]`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{s.element}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ps.badge}`}>
                      {s.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mono mb-1">
                    Current: {s.currentState}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {s.recommendation}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
