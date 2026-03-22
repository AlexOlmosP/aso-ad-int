"use client";

import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";
import type { AdNetwork } from "@/lib/types";

interface AdvertiserCandidate {
  name: string;
  id: string;
  confidence: "high" | "medium" | "low";
}

const ID_CONFIG: Record<
  AdNetwork,
  {
    label: string;
    field: "metaPageId" | "googleAdId" | "tiktokBizId";
    color: string;
    icon: string;
    placeholder: string;
    help: string;
    searchUrl: (name: string) => string;
    pattern: RegExp;
  }
> = {
  meta: {
    label: "Meta",
    field: "metaPageId",
    color: "#1877F2",
    icon: "M",
    placeholder: "e.g. 123456789012345",
    help: "Facebook Page → About → Page Transparency → Page ID",
    searchUrl: (name) =>
      `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(name)}&search_type=keyword_unordered`,
    pattern: /^\d{10,20}$/,
  },
  google: {
    label: "Google",
    field: "googleAdId",
    color: "#4285F4",
    icon: "G",
    placeholder: "e.g. AR17828074650563772417",
    help: "Ads Transparency Center → Advertiser → AR number from URL",
    searchUrl: (name) =>
      `https://adstransparency.google.com/?search=${encodeURIComponent(name)}`,
    pattern: /^AR\d{18,22}$/,
  },
  tiktok: {
    label: "TikTok",
    field: "tiktokBizId",
    color: "#000000",
    icon: "T",
    placeholder: "e.g. 6891503886842987266",
    help: "TikTok Ad Library → Advertiser → Biz ID from URL",
    searchUrl: (name) =>
      `https://library.tiktok.com/ads?adv_name=${encodeURIComponent(name)}`,
    pattern: /^\d{18,20}$/,
  },
};

const CONFIDENCE_STYLES = {
  high: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30",
  medium: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30",
  low: "text-slate-500 bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.06]",
};

export function AdvertiserIdPanel() {
  const { selectedAppId, trackedApps, updateAdvertiserIds } = useStore();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<{
    meta: AdvertiserCandidate[];
    google: AdvertiserCandidate[];
    tiktok: AdvertiserCandidate[];
  } | null>(null);

  const app = trackedApps.find((a) => a.id === selectedAppId);
  if (!app) return null;

  const ids = app.advertiserIds ?? {};
  const hasAnyId = ids.metaPageId || ids.googleAdId || ids.tiktokBizId;

  function handleOpen() {
    setValues({
      metaPageId: ids.metaPageId ?? "",
      googleAdId: ids.googleAdId ?? "",
      tiktokBizId: ids.tiktokBizId ?? "",
    });
    setErrors({});
    setCandidates(null);
    setOpen(true);
  }

  function handleSave() {
    const newErrors: Record<string, string> = {};

    for (const [, config] of Object.entries(ID_CONFIG)) {
      const val = values[config.field]?.trim();
      if (val && !config.pattern.test(val)) {
        newErrors[config.field] = `Invalid format (${config.placeholder})`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateAdvertiserIds(app!.id, {
      metaPageId: values.metaPageId?.trim() || undefined,
      googleAdId: values.googleAdId?.trim() || undefined,
      tiktokBizId: values.tiktokBizId?.trim() || undefined,
    });
    setOpen(false);
  }

  async function handleAutoDetect() {
    setSearching(true);
    setCandidates(null);
    try {
      const res = await fetch("/api/ads/find-advertisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: app!.name,
          developer: app!.developer,
        }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setCandidates(data);

      // Auto-fill high-confidence matches if fields are empty
      if (data.meta?.[0]?.confidence === "high" && !values.metaPageId) {
        setValues(prev => ({ ...prev, metaPageId: data.meta[0].id }));
      }
      if (data.google?.[0]?.confidence === "high" && !values.googleAdId) {
        setValues(prev => ({ ...prev, googleAdId: data.google[0].id }));
      }
      if (data.tiktok?.[0]?.confidence === "high" && !values.tiktokBizId) {
        setValues(prev => ({ ...prev, tiktokBizId: data.tiktok[0].id }));
      }
    } catch (err) {
      console.error("Auto-detect failed:", err);
    } finally {
      setSearching(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
          hasAnyId
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
            : "bg-orange-50 text-[#ec5b13] border border-orange-200/60 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-800/30 shadow-[0_0_12px_rgba(236,91,19,0.08)]"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        {hasAnyId ? "IDs Set" : "Add Advertiser IDs"}
      </button>
    );
  }

  return (
    <AdvertiserModal
      app={app}
      values={values}
      setValues={setValues}
      errors={errors}
      candidates={candidates}
      searching={searching}
      onAutoDetect={handleAutoDetect}
      onSave={handleSave}
      onClose={() => setOpen(false)}
    />
  );
}

function AdvertiserModal({
  app,
  values,
  setValues,
  errors,
  candidates,
  searching,
  onAutoDetect,
  onSave,
  onClose,
}: {
  app: { name: string; developer: string };
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  errors: Record<string, string>;
  candidates: { meta: AdvertiserCandidate[]; google: AdvertiserCandidate[]; tiktok: AdvertiserCandidate[] } | null;
  searching: boolean;
  onAutoDetect: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalRef.current) return;
    gsap.fromTo(modalRef.current,
      { scale: 0.95, opacity: 0, y: 10 },
      { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.5)" }
    );
  }, []);

  const networkCandidateKey: Record<AdNetwork, "meta" | "google" | "tiktok"> = {
    meta: "meta",
    google: "google",
    tiktok: "tiktok",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md" onClick={onClose}>
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-white/[0.06] p-6 backdrop-blur-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg heading-lg text-slate-900 dark:text-white mb-1">
          Advertiser IDs — {app.name}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Auto-detect searches ad libraries using &quot;{app.name}&quot; and &quot;{app.developer}&quot;.
        </p>

        {/* Auto-detect button */}
        <button
          onClick={onAutoDetect}
          disabled={searching}
          className="w-full py-2.5 bg-[#ec5b13] text-white text-xs font-bold rounded-xl premium-btn disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-5"
        >
          {searching ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Searching ad libraries...
            </span>
          ) : "Auto-detect Advertiser IDs"}
        </button>

        <div className="space-y-4">
          {(["meta", "google", "tiktok"] as AdNetwork[]).map((network) => {
            const config = ID_CONFIG[network];
            const networkCandidates = candidates?.[networkCandidateKey[network]] || [];

            return (
              <div key={network}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: config.color }}
                    >
                      {config.icon}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {config.label}
                    </span>
                  </div>
                  <a
                    href={config.searchUrl(app.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-[#ec5b13] hover:underline"
                  >
                    Manual lookup &rarr;
                  </a>
                </div>

                {/* Candidate cards */}
                {searching && (
                  <div className="h-10 rounded-xl skeleton-shimmer mb-2" />
                )}

                {!searching && networkCandidates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {networkCandidates.slice(0, 5).map((candidate) => (
                      <button
                        key={candidate.id}
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            [config.field]: candidate.id,
                          }))
                        }
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-left transition-all hover:shadow-sm ${
                          values[config.field] === candidate.id
                            ? "ring-2 ring-[#ec5b13] border-[#ec5b13]/30"
                            : "hover:border-slate-300 dark:hover:border-white/10"
                        } ${CONFIDENCE_STYLES[candidate.confidence]}`}
                      >
                        <span className="text-[10px] font-bold truncate max-w-[140px]">
                          {candidate.name}
                        </span>
                        <span className="text-[9px] opacity-60 font-mono">
                          {candidate.confidence}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {!searching && candidates && networkCandidates.length === 0 && (
                  <p className="text-[10px] text-slate-400 mb-2">No matches found — enter manually</p>
                )}

                <input
                  type="text"
                  value={values[config.field] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [config.field]: e.target.value,
                    }))
                  }
                  placeholder={config.placeholder}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/80 dark:bg-white/[0.04] text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus-glow"
                />
                {errors[config.field] && (
                  <p className="text-[10px] text-red-500 mt-0.5">
                    {errors[config.field]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2 bg-[#ec5b13] text-white text-sm font-bold rounded-xl premium-btn transition-all"
          >
            Save IDs
          </button>
        </div>
      </div>
    </div>
  );
}
