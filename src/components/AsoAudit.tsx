"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";

const CIRCUMFERENCE = 2 * Math.PI * 40;

function scoreColor(score: number) {
  if (score >= 70) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", ring: "#10B981" };
  if (score >= 40) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", ring: "#F59E0B" };
  return { text: "text-red-500 dark:text-red-400", bar: "bg-red-500", ring: "#EF4444" };
}

export function AsoAudit() {
  const { asoAudit, loading, fetchAsoAudit, selectedAppId } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  // Animate score gauge
  useEffect(() => {
    if (!asoAudit) return;
    const counter = { val: 0 };
    gsap.to(counter, {
      val: asoAudit.overallScore,
      duration: 1,
      ease: "power2.out",
      onUpdate: () => setDisplayScore(Math.round(counter.val)),
    });
    if (circleRef.current) {
      const progress = asoAudit.overallScore / 100;
      gsap.fromTo(circleRef.current,
        { strokeDashoffset: CIRCUMFERENCE },
        { strokeDashoffset: CIRCUMFERENCE * (1 - progress), duration: 1.2, ease: "power2.out" }
      );
    }
  }, [asoAudit]);

  // Staggered factor rows
  useEffect(() => {
    if (!ref.current || !asoAudit) return;
    gsap.fromTo(
      ref.current.querySelectorAll(".audit-row"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, delay: 0.5, ease: "power2.out" }
    );
  }, [asoAudit]);

  const color = asoAudit ? scoreColor(asoAudit.overallScore) : scoreColor(0);

  return (
    <section className="bg-white/80 dark:bg-slate-900/80 rounded-[2rem] border border-slate-200/60 dark:border-white/[0.06] card-shadow overflow-hidden backdrop-blur-sm flex flex-col">
      <div className="p-5 border-b border-slate-100/80 dark:border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="heading-lg text-lg text-slate-900 dark:text-white">ASO Audit</h3>
            <p className="text-xs text-slate-400 mt-1">Score your store listing against ASO best practices</p>
          </div>
          <button
            onClick={fetchAsoAudit}
            disabled={loading.asoAudit || !selectedAppId}
            className="px-5 py-2.5 bg-[#ec5b13] text-white text-xs font-bold rounded-xl premium-btn disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading.asoAudit ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Auditing...
              </span>
            ) : "Run Audit"}
          </button>
        </div>
      </div>

      <div ref={ref} className="flex-1 overflow-y-auto p-4">
        {loading.asoAudit ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl skeleton-shimmer mx-auto w-24" />
            {[1,2,3,4].map(i => <div key={i} className="h-8 rounded-lg skeleton-shimmer" />)}
          </div>
        ) : !asoAudit ? (
          <p className="text-center text-sm text-slate-400 py-8">
            Audit your store listing against ASO best practices
          </p>
        ) : (
          <>
            {/* Score Gauge */}
            <div className="flex flex-col items-center mb-5">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="absolute inset-0 w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="var(--glass-border)" strokeWidth="6" />
                  <circle
                    ref={circleRef}
                    cx="48" cy="48" r="40"
                    fill="none"
                    stroke={color.ring}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE}
                  />
                </svg>
                <span className={`mono text-2xl font-black relative ${color.text}`}>
                  {displayScore}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Overall Score</p>
            </div>

            {/* Factor Breakdown */}
            <div className="space-y-2">
              {asoAudit.factors.map((f) => {
                const fc = scoreColor(f.score);
                const isExpanded = expandedTip === f.name;
                return (
                  <div key={f.name} className="audit-row">
                    <button
                      onClick={() => setExpandedTip(isExpanded ? null : f.name)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{f.name}</span>
                      <div className="w-16 h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden shrink-0">
                        <div className={`h-full rounded-full ${fc.bar}`} style={{ width: `${f.score}%` }} />
                      </div>
                      <span className={`mono text-xs font-bold w-8 text-right ${fc.text}`}>{f.score}</span>
                    </button>
                    {isExpanded && f.tips.length > 0 && (
                      <div className="pl-4 pr-2 pb-2">
                        {f.tips.map((tip, i) => (
                          <p key={i} className="text-[11px] text-slate-500 dark:text-slate-400 py-0.5">
                            - {tip}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
