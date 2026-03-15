"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Todos from "./todos";

interface CalendarEvent {
  title: string;
  time: string;
  date: string;
  location: string | null;
  attendees: number;
}

const tools = [
  {
    name: "Generate Meeting Report",
    description: "Summarize notes and action items from your last meeting",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    name: "View Customer CRM",
    description: "Access customer profiles, deal stages, and engagement history",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    name: "Deployment Tracker",
    description: "Monitor active field deployments and hardware status",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
  {
    name: "Design Canvas",
    description: "Open the RF design workspace for hardware modeling",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
  },
];

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

  useEffect(() => {
    fetch("/api/calendar")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoadingEvents(false);
      })
      .catch(() => setLoadingEvents(false));
  }, []);

  const grouped = groupEventsByDate(events);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />

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
        <header className="flex items-center justify-between border-b border-white/10 px-8 py-4 backdrop-blur-md bg-white/[0.03]">
          <h1 className="text-xs tracking-[0.3em] text-white/50 uppercase font-medium">
            Arena Physica
          </h1>
          <button
            onClick={() => signOut()}
            className="text-xs tracking-widest text-white/40 uppercase hover:text-white/70 transition-colors"
          >
            Sign out
          </button>
        </header>

        {/* Welcome */}
        <div className="px-8 py-8">
          <p
            className="text-3xl text-white/90"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <TypedWelcome firstName={firstName} />
          </p>
        </div>

        {/* Main content */}
        <div className="mx-auto max-w-7xl px-8 py-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
            {/* Left — Tools + Todos */}
            <div className="lg:col-span-3">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h2 className="mb-1 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                    Tools
                  </h2>
                  <p className="text-sm text-white/40">
                    Quick access to your most-used workflows
                  </p>
                </div>
                <Link
                  href="/tools"
                  className="text-[10px] tracking-widest text-white/40 uppercase hover:text-white/70 transition-colors"
                >
                  Browse All Tools
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {tools.map((tool) => (
                  <button
                    key={tool.name}
                    className="group flex flex-col gap-3 rounded border border-white/[0.08] bg-[#2a3040]/90 p-6 text-left backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-[#303848]/95"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-white/60">{tool.icon}</div>
                      <h3 className="text-[13px] font-semibold text-white/90">
                        {tool.name}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed text-white/40">
                      {tool.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* To-dos */}
              <div className="mt-10">
                <h2 className="mb-1 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                  To-dos
                </h2>
                <p className="mb-6 text-sm text-white/40">
                  Track tasks and act on calendar-based suggestions
                </p>
                <Todos events={events} />
              </div>
            </div>

            {/* Right — Upcoming Events (this week) */}
            <div className="lg:col-span-2">
              <h2 className="mb-1 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                This Week
              </h2>
              <p className="mb-6 text-sm text-white/40">Upcoming schedule</p>
              <div className="flex flex-col gap-5">
                {loadingEvents ? (
                  <div className="flex flex-col gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded border border-white/[0.06] bg-[#2a3040]/90 p-4 backdrop-blur-md animate-pulse"
                      >
                        <div className="h-3 w-16 rounded bg-white/10 mb-2" />
                        <div className="h-4 w-40 rounded bg-white/10" />
                      </div>
                    ))}
                  </div>
                ) : events.length === 0 ? (
                  <div className="rounded border border-white/[0.06] bg-[#2a3040]/90 p-6 backdrop-blur-md text-center">
                    <p className="text-sm text-white/40">No upcoming events this week</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([date, dayEvents]) => (
                    <div key={date}>
                      <p className="mb-2 text-[10px] font-medium tracking-widest text-white/30 uppercase">
                        {date}
                      </p>
                      <div className="flex flex-col gap-2">
                        {dayEvents.map((event, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-4 rounded border border-white/[0.08] bg-[#2a3040]/90 p-4 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-[#303848]/95"
                          >
                            <span className="mt-0.5 whitespace-nowrap font-mono text-[11px] text-white/40">
                              {event.time}
                            </span>
                            <div className="flex flex-col gap-1">
                              <p className="text-[13px] font-medium text-white/90">
                                {event.title}
                              </p>
                              {event.attendees > 0 && (
                                <span className="text-[10px] text-white/30">
                                  {event.attendees} attendee{event.attendees !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
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
