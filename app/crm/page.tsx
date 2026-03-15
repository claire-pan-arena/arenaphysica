"use client";

import { useEffect, useState } from "react";
import NavHeader from "../components/nav-header";

interface MeetingNote {
  id: string;
  content: string;
  customer: string;
  eventTitle: string | null;
  eventDate: string | null;
  creatorName: string;
  createdAt: string;
}

const CUSTOMERS = ["Anduril", "Bausch", "Mercedes", "Amd"];

export default function CRMPage() {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const url = selectedCustomer
      ? `/api/notes?customer=${encodeURIComponent(selectedCustomer)}`
      : "/api/notes";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setNotes(data.notes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedCustomer]);

  // Group notes by customer
  const grouped: Record<string, MeetingNote[]> = {};
  for (const note of notes) {
    if (!grouped[note.customer]) grouped[note.customer] = [];
    grouped[note.customer].push(note);
  }

  const customers = selectedCustomer
    ? [selectedCustomer]
    : Object.keys(grouped).sort();

  const filtered = search
    ? notes.filter(
        (n) =>
          n.content.toLowerCase().includes(search.toLowerCase()) ||
          n.customer.toLowerCase().includes(search.toLowerCase()) ||
          (n.eventTitle && n.eventTitle.toLowerCase().includes(search.toLowerCase()))
      )
    : notes;

  const filteredGrouped: Record<string, MeetingNote[]> = {};
  for (const note of filtered) {
    if (!filteredGrouped[note.customer]) filteredGrouped[note.customer] = [];
    filteredGrouped[note.customer].push(note);
  }
  const filteredCustomers = Object.keys(filteredGrouped).sort();

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

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
        <NavHeader />

        <div className="px-8 py-10">
          <div className="mb-8">
            <h2
              className="text-3xl text-white"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              CRM
            </h2>
          </div>

          {/* Customer filter pills */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCustomer(null)}
              className={`rounded-lg px-3 py-1.5 text-[10px] tracking-widest uppercase transition-all ${
                !selectedCustomer
                  ? "bg-white/20 text-white/80 border border-white/30"
                  : "bg-white/[0.07] text-white/60 border border-white/10 hover:bg-white/10"
              }`}
            >
              All
            </button>
            {CUSTOMERS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCustomer(selectedCustomer === c ? null : c)}
                className={`rounded-lg px-3 py-1.5 text-[10px] tracking-widest uppercase transition-all ${
                  selectedCustomer === c
                    ? "bg-white/20 text-white/80 border border-white/30"
                    : "bg-white/[0.07] text-white/60 border border-white/10 hover:bg-white/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white placeholder-white/30 backdrop-blur-xl outline-none focus:border-white/20"
            />
          </div>

          {/* Notes grouped by customer */}
          {loading ? (
            <div className="flex flex-col gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl animate-pulse">
                  <div className="h-5 w-32 rounded bg-white/10 mb-3" />
                  <div className="h-3 w-full rounded bg-white/[0.05] mb-2" />
                  <div className="h-3 w-2/3 rounded bg-white/[0.05]" />
                </div>
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.05] p-6 text-center">
              <p className="text-sm text-white/60">
                {search ? "No notes match your search." : "No meeting notes yet. Add notes from your calendar events on the Dashboard."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {filteredCustomers.map((customer) => (
                <div key={customer}>
                  <h3 className="mb-3 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                    {customer}
                  </h3>
                  <div className="flex flex-col gap-3">
                    {filteredGrouped[customer].map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl transition-all hover:border-white/20"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {note.eventTitle && (
                              <span className="text-[13px] font-medium text-white">
                                {note.eventTitle}
                              </span>
                            )}
                            {note.eventDate && (
                              <span className="text-[10px] text-white/40">
                                {note.eventDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-white/70 whitespace-pre-wrap">
                          {note.content}
                        </p>
                        <p className="mt-3 text-[10px] text-white/30">
                          {note.creatorName} · {timeAgo(note.createdAt)}
                        </p>
                      </div>
                    ))}
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
