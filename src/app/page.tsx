"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import gsap from "gsap";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { KeywordTable } from "@/components/KeywordTable";
import { StoreListingView } from "@/components/StoreListingView";
import { KeywordSuggestions } from "@/components/KeywordSuggestions";
import { AsoAudit } from "@/components/AsoAudit";
import { CroSuggestions } from "@/components/CroSuggestions";
import { AdIntelView } from "@/components/AdSection";
import { useStore } from "@/lib/store";

function ViewTransition({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [currentKey, setCurrentKey] = useState(viewKey);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (viewKey === currentKey) { setDisplayChildren(children); return; }

    const el = containerRef.current;
    if (!el) { setDisplayChildren(children); setCurrentKey(viewKey); return; }

    gsap.to(el, {
      opacity: 0, y: 12, duration: 0.15, ease: "power2.in",
      onComplete: () => {
        setDisplayChildren(children);
        setCurrentKey(viewKey);
        gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" });
      },
    });
  }, [viewKey, children, currentKey]);

  return <div ref={containerRef}>{displayChildren}</div>;
}

export default function Home() {
  const { activeTool, selectedAppId } = useStore();
  const emptyRef = useRef<HTMLDivElement>(null);

  // Empty state entrance animation
  useEffect(() => {
    if (!emptyRef.current || selectedAppId) return;
    gsap.fromTo(emptyRef.current.querySelector(".empty-icon"),
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)" }
    );
    gsap.fromTo(emptyRef.current.querySelectorAll(".empty-text"),
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, delay: 0.15, ease: "power2.out" }
    );
  }, [selectedAppId]);

  const viewKey = !selectedAppId ? "empty" : activeTool;

  function renderView() {
    if (!selectedAppId) {
      return (
        <div ref={emptyRef} className="flex flex-col items-center justify-center h-full text-center">
          <div className="empty-icon size-20 bg-slate-100 dark:bg-white/[0.04] rounded-2xl flex items-center justify-center mb-6 card-shadow">
            <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="empty-text text-xl heading-lg text-slate-400 mb-2">
            Get Started
          </h2>
          <p className="empty-text text-sm text-slate-400 max-w-sm">
            Add an app from the sidebar to start analyzing its ad
            intelligence and ASO performance.
          </p>
        </div>
      );
    }

    switch (activeTool) {
      case "ad-intel":
        return <AdIntelView />;
      case "aso-keywords":
        return (
          <>
            <StoreListingView />
            <KeywordTable />
          </>
        );
      case "aso-suggestions":
        return <KeywordSuggestions />;
      case "aso-audit":
        return <AsoAudit />;
      case "aso-cro":
        return <CroSuggestions />;
      default:
        return <AdIntelView />;
    }
  }

  return (
    <div className="flex min-h-[100dvh] h-[100dvh] overflow-hidden bg-[#F9FAFB] dark:bg-[#18181B] text-slate-900 dark:text-slate-100 grain">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <ViewTransition viewKey={viewKey}>
            {renderView()}
          </ViewTransition>
        </div>
      </main>
    </div>
  );
}
