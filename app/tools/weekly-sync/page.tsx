"use client";

import { useState } from "react";
import NavHeader from "../../components/nav-header";
import Markdown from "../../components/markdown";

export default function WeeklySyncPage() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const generateAgenda = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/weekly-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.error) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult(data.content);
      }
    } catch {
      setResult("Failed to generate agenda.");
    }
    setGenerating(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0" style={{ background: "radial-gradient(ellipse 120% 60% at 50% 80%, rgba(180,160,130,0.3) 0%, transparent 70%)" }} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 400 400" className="h-[800px] w-[800px] animate-[spin_30s_linear_infinite] opacity-[0.05]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
        </svg>
      </div>

      <div className="relative z-10">
        <NavHeader />

        <div className="px-8 py-10 max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl text-white" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
              Weekly Sync
            </h2>
            <p className="mt-2 text-sm text-white/50">Generate a structured weekly sync agenda from your calendar events.</p>
          </div>

          <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
            <p className="text-sm text-white/60 mb-4">
              This will pull your calendar events for the current week (Mon-Fri) and generate a structured sync agenda with key meetings, preparation needed, and discussion topics.
            </p>
            <button
              onClick={generateAgenda}
              disabled={generating}
              className="rounded-lg border border-white/30 bg-white/20 px-5 py-2.5 text-xs tracking-widest text-white/80 uppercase transition-all hover:bg-white/25 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Agenda"}
            </button>
          </div>

          {result && (
            <div className="rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                Weekly Agenda
              </h3>
              <Markdown content={result} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
