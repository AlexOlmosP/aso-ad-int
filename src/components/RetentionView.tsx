"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function RetentionView() {
  const { revenueEstimate, loading, fetchRevenueEstimate, selectedAppId } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !revenueEstimate) return;
    gsap.fromTo(
      containerRef.current.querySelectorAll(".ret-card"),
      { opacity: 0, y: 12, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.06, ease: "power2.out" }
    );
  }, [revenueEstimate]);

  const retentionColor = (val: number) => {
    if (val >= 0.30) return "text-emerald-600 dark:text-emerald-400";
    if (val >= 0.15) return "text-blue-600 dark:text-blue-400";
    if (val >= 0.08) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  const retentionBg = (val: number) => {
    if (val >= 0.30) return "from-emerald-500/10 to-emerald-50/30 dark:from-emerald-500/15 dark:to-emerald-900/10 border-emerald-200/40 dark:border-emerald-800/30";
    if (val >= 0.15) return "from-blue-500/10 to-blue-50/30 dark:from-blue-500/15 dark:to-blue-900/10 border-blue-200/40 dark:border-blue-800/30";
    if (val >= 0.08) return "from-amber-500/10 to-amber-50/30 dark:from-amber-500/15 dark:to-amber-900/10 border-amber-200/40 dark:border-amber-800/30";
    return "from-red-500/10 to-red-50/30 dark:from-red-500/15 dark:to-red-900/10 border-red-200/40 dark:border-red-800/30";
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30";
    if (c === "medium") return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30";
    return "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30";
  };

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] border border-slate-200/60 dark:border-white/[0.06] card-shadow overflow-hidden backdrop-blur-sm">
      <div className="p-5 border-b border-slate-100/80 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="heading-lg text-lg text-slate-900 dark:text-white">Retention Estimates</h3>
            <p className="text-xs text-slate-400 mt-1">Estimated user retention based on category benchmarks and app quality</p>
          </div>
          <button
            onClick={fetchRevenueEstimate}
            disabled={loading.revenueEstimate || !selectedAppId}
            className="px-5 py-2.5 bg-[#ec5b13] text-white text-xs font-bold rounded-xl premium-btn disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading.revenueEstimate ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Estimating...
              </span>
            ) : "Estimate Retention"}
          </button>
        </div>
      </div>

      {loading.revenueEstimate ? (
        <div className="p-5 grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      ) : !revenueEstimate ? (
        <p className="text-center text-sm text-slate-400 py-12">
          Estimate D1, D7, and D30 retention for this app
        </p>
      ) : (
        <div ref={containerRef} className="p-5 space-y-5">
          {/* Confidence */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase ${confidenceColor(revenueEstimate.confidence)}`}>
              {revenueEstimate.confidence} confidence
            </span>
            <span className="text-[10px] text-slate-400">
              {revenueEstimate.breakdown.category || "Unknown"} category benchmarks, adjusted by rating
            </span>
          </div>

          {/* Retention cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Day 1", key: "d1" as const, desc: "Users returning after 1 day" },
              { label: "Day 7", key: "d7" as const, desc: "Users returning after 1 week" },
              { label: "Day 30", key: "d30" as const, desc: "Users returning after 1 month" },
            ].map(({ label, key, desc }) => {
              const value = revenueEstimate.retention[key];
              return (
                <div
                  key={key}
                  className={`ret-card bg-gradient-to-br ${retentionBg(value)} rounded-2xl p-5 border text-center`}
                >
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</p>
                  <p className={`text-3xl heading-lg mono mt-2 ${retentionColor(value)}`}>
                    {formatPercent(value)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2">{desc}</p>

                  {/* Visual bar */}
                  <div className="mt-3 h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        value >= 0.30 ? "bg-emerald-500" :
                        value >= 0.15 ? "bg-blue-500" :
                        value >= 0.08 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(100, value * 200)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Retention curve */}
          <div className="ret-card bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/[0.04]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Retention Curve</p>
            <div className="flex items-end gap-1 h-24">
              {/* D0 = 100% */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[#ec5b13] rounded-t" style={{ height: "96px" }} />
                <span className="text-[9px] mono text-slate-400">D0</span>
                <span className="text-[9px] mono font-bold text-slate-600 dark:text-slate-300">100%</span>
              </div>
              {/* D1 */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[#ec5b13]/80 rounded-t" style={{ height: `${revenueEstimate.retention.d1 * 96}px` }} />
                <span className="text-[9px] mono text-slate-400">D1</span>
                <span className="text-[9px] mono font-bold text-slate-600 dark:text-slate-300">{formatPercent(revenueEstimate.retention.d1)}</span>
              </div>
              {/* D7 */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[#ec5b13]/60 rounded-t" style={{ height: `${revenueEstimate.retention.d7 * 96}px` }} />
                <span className="text-[9px] mono text-slate-400">D7</span>
                <span className="text-[9px] mono font-bold text-slate-600 dark:text-slate-300">{formatPercent(revenueEstimate.retention.d7)}</span>
              </div>
              {/* D30 */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[#ec5b13]/40 rounded-t" style={{ height: `${revenueEstimate.retention.d30 * 96}px` }} />
                <span className="text-[9px] mono text-slate-400">D30</span>
                <span className="text-[9px] mono font-bold text-slate-600 dark:text-slate-300">{formatPercent(revenueEstimate.retention.d30)}</span>
              </div>
            </div>
          </div>

          {/* Methodology */}
          <div className="ret-card bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/[0.04]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Methodology</p>
            <div className="space-y-2 text-xs text-slate-500">
              <p>Base retention rates from industry benchmarks for the <span className="font-bold text-slate-700 dark:text-slate-300">{revenueEstimate.breakdown.category}</span> category.</p>
              <p>Adjusted by app rating and engagement signals (rating count as proxy for user base size).</p>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center italic">
            Estimates based on industry category averages. Actual retention depends on onboarding, content, and user acquisition quality.
          </p>
        </div>
      )}
    </section>
  );
}
