"use client";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { KeywordTable } from "@/components/KeywordTable";
import { StoreListingView } from "@/components/StoreListingView";
import { AdIntelView } from "@/components/AdSection";
import { useStore } from "@/lib/store";

export default function Home() {
  const { activeTool, selectedAppId } = useStore();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f6f6] dark:bg-[#1a1a1a] text-slate-900 dark:text-slate-100">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {!selectedAppId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-400 mb-2">
                Get Started
              </h2>
              <p className="text-sm text-slate-400 max-w-sm">
                Add an app from the sidebar to start analyzing its ad
                intelligence and ASO performance.
              </p>
            </div>
          ) : activeTool === "ad-intel" ? (
            <AdIntelView />
          ) : (
            <>
              <StoreListingView />
              <KeywordTable />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
