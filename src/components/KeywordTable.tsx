"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export function KeywordTable() {
  const {
    keywords,
    addKeywords,
    removeKeyword,
    fetchKeywordData,
    loading,
    selectedAppId,
    selectedStore,
  } = useStore();
  const [newTerm, setNewTerm] = useState("");

  const handleAdd = () => {
    const input = newTerm.trim();
    if (!input) return;
    addKeywords(input);
    setNewTerm("");
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 card-shadow overflow-hidden flex flex-col">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">
            ASO Research: Keywords
          </h3>
          <button
            onClick={fetchKeywordData}
            disabled={loading.keywords || !selectedAppId || keywords.length === 0}
            className="px-4 py-2 bg-[#ec5b13] text-white text-xs font-bold rounded-lg premium-btn disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading.keywords ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                Analyzing...
              </span>
            ) : (
              "Analyze Keywords"
            )}
          </button>
        </div>

        {/* Add keyword input — supports comma-separated */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add keywords (comma-separated, e.g. fitness tracker, workout app, gym log)"
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ec5b13] text-slate-900 dark:text-white placeholder-slate-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newTerm.trim()}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {keywords.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-400">
          Add keywords above to start tracking their performance
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="px-6 py-4">Keyword</th>
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">
                  {selectedStore === "appstore" ? "App Store" : "Play Store"} Vol.
                </th>
                <th className="px-6 py-4">Relevant</th>
                {selectedStore === "appstore" && (
                  <th className="px-6 py-4">Apple Search Ads</th>
                )}
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {keywords.map((kw) => (
                <tr
                  key={kw.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-[#ec5b13]">
                    {kw.term}
                  </td>
                  <td className="px-6 py-4">
                    {kw.rank !== null && kw.rank !== undefined ? (
                      <div className="flex items-center gap-1">
                        <span className={`font-bold ${kw.rank <= 10 ? "text-green-600" : kw.rank <= 50 ? "text-yellow-600" : "text-slate-600 dark:text-slate-300"}`}>
                          #{kw.rank}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        {kw.searchVolume > 0 ? "100+" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#ec5b13] rounded-full transition-all"
                          style={{ width: `${kw.searchVolume}%` }}
                        />
                      </div>
                      <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                        {kw.searchVolume || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        kw.relevant
                          ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      {kw.searchVolume > 0 ? (kw.relevant ? "Yes" : "No") : "—"}
                    </span>
                  </td>
                  {selectedStore === "appstore" && (
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          kw.appleSearchAds
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        {kw.searchVolume > 0 ? (kw.appleSearchAds ? "Yes" : "No") : "—"}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <button
                      onClick={() => removeKeyword(kw.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
