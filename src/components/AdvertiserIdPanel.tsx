"use client";

import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useStore } from "@/lib/store";
import type { AdNetwork } from "@/lib/types";

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

export function AdvertiserIdPanel() {
  const { selectedAppId, trackedApps, updateAdvertiserIds } = useStore();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);

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
  onSave,
  onClose,
}: {
  app: { name: string };
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  errors: Record<string, string>;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md" onClick={onClose}>
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-white/[0.06] p-6 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg heading-lg text-slate-900 dark:text-white mb-1">
          Advertiser IDs — {app.name}
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          Adding IDs greatly improves ad scraping accuracy. Click &quot;Find&quot; to open the ad library and locate the ID.
        </p>

        <div className="space-y-4">
          {(["meta", "google", "tiktok"] as AdNetwork[]).map((network) => {
            const config = ID_CONFIG[network];
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
                    Find ID &rarr;
                  </a>
                </div>
                <p className="text-[10px] text-slate-400 mb-1">{config.help}</p>
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
