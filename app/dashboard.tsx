"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Todos from "./todos";

interface CalendarEvent {
  title: string;
  time: string;
  date: string;
  isoDate: string;
  location: string | null;
  attendees: number;
}

const CUSTOMER_PATTERN = /anduril|bausch|b\+l|b&l|mercedes|amd/i;

function isExternalMeeting(title: string): boolean {
  return CUSTOMER_PATTERN.test(title);
}

interface EnabledTool {
  id: string;
  name: string;
}

function TypedWelcome({ firstName }: { firstName: string }) {
  const fullText = `Welcome to Ground Control, ${firstName}`;
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [fullText]);

  return (
    <span>
      {displayed}
      {displayed.length < fullText.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

function groupEventsByDate(events: CalendarEvent[]) {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    if (!groups[event.date]) groups[event.date] = [];
    groups[event.date].push(event);
  }
  return groups;
}

export default function Dashboard({ firstName }: { firstName: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [modalEvent, setModalEvent] = useState<{ title: string; date: string } | null>(null);
  const [calFilter, setCalFilter] = useState<"all" | "external">("all");
  const [enabledTools, setEnabledTools] = useState<EnabledTool[]>([]);
  const [showAllTools, setShowAllTools] = useState(false);

  useEffect(() => {
    fetch("/api/calendar")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoadingEvents(false);
      })
      .catch(() => setLoadingEvents(false));

    fetch("/api/tools")
      .then((res) => res.json())
      .then((data) => {
        const tools = data.tools || [];
        const enabledIds = new Set(data.enabledIds || []);
        setEnabledTools(
          tools
            .filter((t: any) => enabledIds.has(t.id))
            .map((t: any) => ({ id: t.id, name: t.name }))
        );
      })
      .catch(() => {});
  }, []);

  const filteredEvents = calFilter === "external"
    ? events.filter((e) => isExternalMeeting(e.title))
    : events;
  const grouped = groupEventsByDate(filteredEvents);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />
      <div className="fixed inset-0 bg-black/30" />

      {/* Horizon glow */}
      <div
        className="fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 80%, rgba(180,160,130,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Large wireframe sphere */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          viewBox="0 0 400 400"
          className="h-[800px] w-[800px] animate-[spin_30s_linear_infinite] opacity-[0.05]"
        >
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="60" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
          <line x1="20" y1="200" x2="380" y2="200" stroke="white" strokeWidth="0.3" />
          <line x1="200" y1="20" x2="200" y2="380" stroke="white" strokeWidth="0.3" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-4">
          <Link href="/" className="text-xs tracking-[0.3em] text-[#c5b9a8] uppercase font-medium hover:text-[#e8e5e0] transition-colors">
            Arena Physica
          </Link>
          <button
            onClick={() => signOut()}
            className="text-xs tracking-widest text-[#9a9da6] uppercase hover:text-[#e8e5e0] transition-colors"
          >
            Sign out
          </button>
        </header>

        {/* Welcome */}
        <div className="px-8 py-8">
          <p
            className="text-3xl text-[#e8e5e0]"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            <TypedWelcome firstName={firstName} />
          </p>
        </div>

        {/* Main content */}
        <div className="px-8 py-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
            {/* Left — Tools + Action Items */}
            <div className="lg:col-span-3">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h2 className="text-[11px] font-medium tracking-widest text-[#a09570] uppercase">
                    Tools
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href="/kb"
                    className="text-[10px] tracking-widest text-[#9a9da6] uppercase hover:text-[#e8e5e0] transition-colors"
                  >
                    Knowledge Base
                  </Link>
                  <Link
                    href="/tools"
                    className="text-[10px] tracking-widest text-[#9a9da6] uppercase hover:text-[#e8e5e0] transition-colors"
                  >
                    Browse Tools Library
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(showAllTools ? enabledTools : enabledTools.slice(0, 4)).map((tool) => (
                  <button
                    key={tool.id}
                    className="group rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 px-6 py-5 text-left backdrop-blur-xl transition-all duration-200 hover:border-[#8a9a5b]/35 hover:bg-[#2d3a2e]/85"
                  >
                    <h3 className="text-[14px] font-medium text-[#e8e5e0]">
                      {tool.name}
                    </h3>
                  </button>
                ))}
                {!showAllTools && enabledTools.length > 4 && (
                  <button
                    onClick={() => setShowAllTools(true)}
                    className="group rounded-lg border border-dashed border-[#8a9a5b]/15 bg-[#2d3a2e]/40 px-6 py-5 text-left backdrop-blur-xl transition-all duration-200 hover:border-[#8a9a5b]/30 hover:bg-[#2d3a2e]/60"
                  >
                    <h3 className="text-[14px] font-medium text-[#9a9da6]">
                      + {enabledTools.length - 4} More Tools
                    </h3>
                  </button>
                )}
              </div>

              {/* Action Items */}
              <div className="mt-10">
                <h2 className="mb-6 text-[11px] font-medium tracking-widest text-[#a09570] uppercase">
                  Action Items
                </h2>
                <Todos events={events} modalEvent={modalEvent} onModalClose={() => setModalEvent(null)} enabledTools={enabledTools} />
              </div>
            </div>

            {/* Right — Upcoming Events (this week) */}
            <div className="lg:col-span-2">
              <h2 className="mb-3 text-[11px] font-medium tracking-widest text-[#a09570] uppercase">
                This Week
              </h2>
              <div className="mb-6 flex gap-2">
                {(["all", "external"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setCalFilter(f)}
                    className={`rounded-lg px-3 py-1 text-[10px] tracking-widest uppercase transition-all ${
                      calFilter === f
                        ? "bg-[#8a9a5b]/20 text-[#c5b9a8] border border-[#8a9a5b]/30"
                        : "bg-[#2d3a2e]/40 text-[#9a9da6] border border-[#9a9da6]/15 hover:bg-[#2d3a2e]/60"
                    }`}
                  >
                    {f === "all" ? "All" : "External"}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-5">
                {loadingEvents ? (
                  <div className="flex flex-col gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/60 p-4 backdrop-blur-xl animate-pulse"
                      >
                        <div className="h-3 w-16 rounded bg-[#8a9a5b]/10 mb-2" />
                        <div className="h-4 w-40 rounded bg-[#8a9a5b]/10" />
                      </div>
                    ))}
                  </div>
                ) : events.length === 0 ? (
                  <div className="rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/60 p-6 backdrop-blur-xl text-center">
                    <p className="text-sm text-[#9a9da6]">No upcoming events this week</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([date, dayEvents]) => (
                    <div key={date}>
                      <p className="mb-2 text-[10px] font-medium tracking-widest text-[#a09570]/60 uppercase">
                        {date}
                      </p>
                      <div className="flex flex-col gap-2">
                        {dayEvents.map((event, i) => (
                          <div
                            key={i}
                            className="flex items-start justify-between rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 p-4 backdrop-blur-xl transition-all duration-200 hover:border-[#8a9a5b]/35 hover:bg-[#2d3a2e]/85"
                          >
                            <div className="flex items-start gap-4">
                              <span className="mt-0.5 whitespace-nowrap font-mono text-[11px] text-[#9a9da6]">
                                {event.time}
                              </span>
                              <div className="flex flex-col gap-1">
                                <p className="text-[13px] font-medium text-[#e8e5e0]">
                                  {event.title}
                                </p>
                                {event.attendees > 0 && (
                                  <span className="text-[10px] text-[#9a9da6]/60">
                                    {event.attendees} attendee{event.attendees !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setModalEvent({ title: event.title, date: event.isoDate })}
                              className="mt-0.5 p-1 text-[#9a9da6]/40 hover:text-[#8a9a5b] transition-colors"
                              title="Create action item"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
