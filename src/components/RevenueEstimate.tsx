"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function RevenueEstimate() {
  const { revenueEstimate, loading, fetchRevenueEstimate, selectedAppId } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !revenueEstimate) return;
    gsap.fromTo(
      containerRef.current.querySelectorAll(".rev-card"),
      { opacity: 0, y: 12, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.06, ease: "power2.out" }
    );
  }, [revenueEstimate]);

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30";
    if (c === "medium") return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30";
    return "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30";
  };

  const isZeroRevenue = revenueEstimate && revenueEstimate.monthlyRevenue.mid === 0;

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] border border-slate-200/60 dark:border-white/[0.06] card-shadow overflow-hidden backdrop-blur-sm">
      <div className="p-5 border-b border-slate-100/80 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="heading-lg text-lg text-slate-900 dark:text-white">Revenue Estimates</h3>
            <p className="text-xs text-slate-400 mt-1">Estimated IAP and ad revenue from public signals</p>
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
            ) : "Estimate"}
          </button>
        </div>
      </div>

      {loading.revenueEstimate ? (
        <div className="p-5 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      ) : !revenueEstimate ? (
        <p className="text-center text-sm text-slate-400 py-12">
          Estimate how much this app earns from in-app purchases and ads
        </p>
      ) : (
        <div ref={containerRef} className="p-5 space-y-5">
          {/* Confidence */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase ${confidenceColor(revenueEstimate.confidence)}`}>
              {revenueEstimate.confidence} confidence
            </span>
            <span className="text-[10px] text-slate-400">
              {revenueEstimate.breakdown.category || "Unknown"} category
            </span>
          </div>

          {isZeroRevenue ? (
            <div className="rev-card bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-6 text-center border border-slate-100 dark:border-white/[0.04]">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No IAP Revenue Detected</p>
              <p className="text-xs text-slate-400 mt-1">
                {revenueEstimate.breakdown.hasAds
                  ? "This app likely monetizes through ads only"
                  : "This app does not appear to offer in-app purchases"}
              </p>
            </div>
          ) : (
            <>
              {/* Revenue cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rev-card bg-gradient-to-br from-[#ec5b13]/5 to-orange-50/50 dark:from-[#ec5b13]/10 dark:to-orange-900/10 rounded-2xl p-4 border border-[#ec5b13]/10 dark:border-[#ec5b13]/20">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Monthly Revenue</p>
                  <p className="text-2xl heading-lg text-slate-900 dark:text-white mono">
                    {formatCurrency(revenueEstimate.monthlyRevenue.mid)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 mono">
                    {formatCurrency(revenueEstimate.monthlyRevenue.low)} — {formatCurrency(revenueEstimate.monthlyRevenue.high)}
                  </p>
                </div>

                <div className="rev-card bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/[0.04]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Daily Revenue</p>
                  <p className="text-2xl heading-lg text-slate-900 dark:text-white mono">
                    {formatCurrency(revenueEstimate.dailyRevenue.mid)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 mono">
                    {formatCurrency(revenueEstimate.dailyRevenue.low)} — {formatCurrency(revenueEstimate.dailyRevenue.high)}
                  </p>
                </div>
              </div>

              {/* IAP / Ad Revenue Split */}
              {revenueEstimate.breakdown.hasAds && (
                <div className="rev-card">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Revenue Split</p>
                  <div className="flex h-4 rounded-full overflow-hidden">
                    <div
                      className="bg-[#ec5b13] flex items-center justify-center"
                      style={{ width: `${revenueEstimate.breakdown.iapRevenueShare * 100}%` }}
                    >
                      <span className="text-[9px] font-bold text-white">IAP {Math.round(revenueEstimate.breakdown.iapRevenueShare * 100)}%</span>
                    </div>
                    <div
                      className="bg-blue-500 flex items-center justify-center"
                      style={{ width: `${revenueEstimate.breakdown.adRevenueShare * 100}%` }}
                    >
                      <span className="text-[9px] font-bold text-white">Ads {Math.round(revenueEstimate.breakdown.adRevenueShare * 100)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Revenue range bar */}
              <div className="rev-card">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Monthly Range</p>
                <div className="relative h-3 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  {revenueEstimate.monthlyRevenue.high > 0 && (
                    <div
                      className="absolute top-0 h-full bg-gradient-to-r from-amber-400 via-[#ec5b13] to-red-500 rounded-full"
                      style={{
                        left: `${(revenueEstimate.monthlyRevenue.low / revenueEstimate.monthlyRevenue.high) * 100}%`,
                        width: `${100 - (revenueEstimate.monthlyRevenue.low / revenueEstimate.monthlyRevenue.high) * 100}%`,
                      }}
                    />
                  )}
                  {revenueEstimate.monthlyRevenue.high > 0 && (
                    <div
                      className="absolute top-0 w-0.5 h-full bg-white dark:bg-slate-900 shadow"
                      style={{
                        left: `${(revenueEstimate.monthlyRevenue.mid / revenueEstimate.monthlyRevenue.high) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] mono text-slate-400">{formatCurrency(revenueEstimate.monthlyRevenue.low)}</span>
                  <span className="text-[10px] mono font-bold text-[#ec5b13]">{formatCurrency(revenueEstimate.monthlyRevenue.mid)}</span>
                  <span className="text-[10px] mono text-slate-400">{formatCurrency(revenueEstimate.monthlyRevenue.high)}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="rev-card bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/[0.04]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Estimation Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Est. Downloads</span>
                    <span className="text-xs font-bold mono text-slate-900 dark:text-white">
                      {formatNumber(revenueEstimate.breakdown.estimatedDownloads.min)} — {formatNumber(revenueEstimate.breakdown.estimatedDownloads.max)}
                    </span>
                  </div>
                  {revenueEstimate.breakdown.iapPriceRange && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">IAP Price Range</span>
                      <span className="text-xs font-bold mono text-slate-900 dark:text-white">
                        {revenueEstimate.breakdown.iapPriceRange}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Weighted Avg IAP</span>
                    <span className="text-xs font-bold mono text-slate-900 dark:text-white">
                      ${revenueEstimate.breakdown.avgIapPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">IAP Conversion Rate</span>
                    <span className="text-xs font-bold mono text-slate-900 dark:text-white">
                      {(revenueEstimate.breakdown.conversionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Category</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {revenueEstimate.breakdown.category}
                    </span>
                  </div>
                  {revenueEstimate.breakdown.hasAds && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Monetization</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        IAP ({Math.round(revenueEstimate.breakdown.iapRevenueShare * 100)}%) + Ads ({Math.round(revenueEstimate.breakdown.adRevenueShare * 100)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center italic">
                Revenue uses industry-weighted IAP pricing (65% low-tier, 15% mid-tier, 20% whale). Range is ±30%.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
