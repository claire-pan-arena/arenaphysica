"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Tool {
  id: string;
  name: string;
  description: string;
  creator: string;
  creatorEmail: string;
  category: string;
  url?: string;
}

const categories = ["All", "Productivity", "Sales", "Operations", "Engineering", "Other"];

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [newTool, setNewTool] = useState({ name: "", description: "", category: "Productivity", url: "" });

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools || []);
        setEnabled(new Set(data.enabledIds || []));
        setCurrentUserEmail(data.currentUserEmail || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleTool = async (id: string) => {
    const willEnable = !enabled.has(id);
    setEnabled((prev) => {
      const next = new Set(prev);
      if (willEnable) next.add(id);
      else next.delete(id);
      return next;
    });
    await fetch("/api/tools/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: id, enabled: willEnable }),
    });
  };

  const createTool = async () => {
    if (!newTool.name.trim()) return;
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTool),
    });
    const { id } = await res.json();
    const data = await fetch("/api/tools").then((r) => r.json());
    setTools(data.tools || []);
    setEnabled(new Set(data.enabledIds || []));
    setCurrentUserEmail(data.currentUserEmail || "");
    setNewTool({ name: "", description: "", category: "Productivity", url: "" });
    setShowCreate(false);
  };

  const deleteTool = async (id: string) => {
    await fetch("/api/tools", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTools((prev) => prev.filter((t) => t.id !== id));
    setEnabled((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const filtered = filter === "All" ? tools : tools.filter((t) => t.category === filter);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />
      <div className="fixed inset-0 bg-black/30" />
      <div
        className="fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 80%, rgba(180,160,130,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Wireframe */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          viewBox="0 0 400 400"
          className="h-[800px] w-[800px] animate-[spin_30s_linear_infinite] opacity-[0.05]"
        >
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <header className="flex items-center justify-between px-8 py-4">
          <Link href="/" className="text-xs tracking-[0.3em] text-[#c5b9a8] uppercase font-medium hover:text-[#e8e5e0] transition-colors">
            Arena Physica
          </Link>
          <Link
            href="/"
            className="text-xs tracking-widest text-[#9a9da6] uppercase hover:text-[#e8e5e0] transition-colors"
          >
            Back to Dashboard
          </Link>
        </header>

        <div className="px-8 py-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2
                className="text-3xl text-[#e8e5e0]"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                Tool Library
              </h2>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="rounded-lg border border-[#8a9a5b]/20 bg-[#2d3a2e]/70 px-5 py-2.5 text-xs tracking-widest text-[#c5b9a8] uppercase backdrop-blur-xl transition-all hover:border-[#8a9a5b]/40 hover:bg-[#2d3a2e]/85"
            >
              {showCreate ? "Cancel" : "+ New Tool"}
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="mb-8 rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-[#a09570] uppercase">
                Create a new tool
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Tool name"
                  value={newTool.name}
                  onChange={(e) => setNewTool((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 backdrop-blur-xl outline-none focus:border-[#8a9a5b]/35"
                />
                <select
                  value={newTool.category}
                  onChange={(e) => setNewTool((p) => ({ ...p, category: e.target.value }))}
                  className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] backdrop-blur-xl outline-none focus:border-[#8a9a5b]/35"
                >
                  {categories.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c} className="bg-[#2d3a2e] text-[#e8e5e0]">
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={newTool.description}
                  onChange={(e) => setNewTool((p) => ({ ...p, description: e.target.value }))}
                  className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 backdrop-blur-xl outline-none focus:border-[#8a9a5b]/35 sm:col-span-2"
                />
                <input
                  type="text"
                  placeholder="URL (optional)"
                  value={newTool.url}
                  onChange={(e) => setNewTool((p) => ({ ...p, url: e.target.value }))}
                  className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 backdrop-blur-xl outline-none focus:border-[#8a9a5b]/35"
                />
                <button
                  onClick={createTool}
                  className="rounded-lg border border-[#8a9a5b]/30 bg-[#8a9a5b]/20 px-5 py-2.5 text-xs tracking-widest text-[#c5b9a8] uppercase backdrop-blur-xl transition-all hover:bg-[#8a9a5b]/30"
                >
                  Create Tool
                </button>
              </div>
            </div>
          )}

          {/* Category filter */}
          <div className="mb-6 flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-lg px-4 py-1.5 text-[11px] tracking-widest uppercase transition-all ${
                  filter === cat
                    ? "bg-[#8a9a5b]/20 text-[#c5b9a8] border border-[#8a9a5b]/30"
                    : "bg-[#2d3a2e]/40 text-[#9a9da6] border border-[#9a9da6]/15 hover:bg-[#2d3a2e]/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tools grid */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/60 p-5 backdrop-blur-xl animate-pulse">
                  <div className="h-4 w-32 rounded bg-[#8a9a5b]/10 mb-3" />
                  <div className="h-3 w-full rounded bg-[#8a9a5b]/5 mb-2" />
                  <div className="h-3 w-2/3 rounded bg-[#8a9a5b]/5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tool) => (
                <div
                  key={tool.id}
                  className="flex flex-col justify-between rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 p-5 backdrop-blur-xl transition-all hover:border-[#8a9a5b]/35 hover:bg-[#2d3a2e]/85"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-[14px] font-medium text-[#e8e5e0]">
                        {tool.name}
                      </h3>
                      <span className="ml-2 whitespace-nowrap rounded bg-[#8a9a5b]/10 px-2 py-0.5 text-[9px] tracking-wider text-[#a09570] uppercase">
                        {tool.category}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#9a9da6] mb-3">
                      {tool.description}
                    </p>
                    <p className="text-[10px] text-[#9a9da6]/50">
                      by {tool.creator}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      onClick={() => toggleTool(tool.id)}
                      className={`rounded-lg px-4 py-1.5 text-[10px] tracking-widest uppercase transition-all ${
                        enabled.has(tool.id)
                          ? "bg-[#8a9a5b]/20 text-[#c5b9a8] border border-[#8a9a5b]/30"
                          : "bg-[#2d3a2e]/40 text-[#9a9da6] border border-[#9a9da6]/15 hover:bg-[#2d3a2e]/60"
                      }`}
                    >
                      {enabled.has(tool.id) ? "Enabled" : "Enable"}
                    </button>
                    {tool.creatorEmail === currentUserEmail && (
                      <button
                        onClick={() => deleteTool(tool.id)}
                        className="text-[#9a9da6]/30 hover:text-[#e8e5e0] transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
