"use client";

import { signOut } from "next-auth/react";

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

const upcomingEvents = [
  { time: "10:00 AM", title: "Field Sync — West Region", tag: "Standup" },
  { time: "11:30 AM", title: "Customer Demo — Northrop", tag: "External" },
  { time: "1:00 PM", title: "Hardware Review — PCB Rev 3", tag: "Design" },
  { time: "3:00 PM", title: "Deployment Strategy — Q2", tag: "Planning" },
  { time: "4:30 PM", title: "Firmware OTA Debrief", tag: "Engineering" },
];

const tagColors: Record<string, string> = {
  Standup: "bg-[#4a5540]/20 text-[#4a5540]",
  External: "bg-[#5a4a6a]/20 text-[#5a4a6a]",
  Design: "bg-[#6a5a40]/20 text-[#6a5a40]",
  Planning: "bg-[#405a6a]/20 text-[#405a6a]",
  Engineering: "bg-[#6a4040]/20 text-[#6a4040]",
};

export default function Dashboard({ firstName }: { firstName: string }) {
  return (
    <div className="min-h-screen bg-[#f4f1eb]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#d9d5cc] px-8 py-5">
        <div className="flex items-center gap-6">
          <h1
            className="text-xl tracking-tight text-[#1a1a1a]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Ground Control
          </h1>
          <span className="text-xs tracking-widest text-[#a09e97] uppercase">
            Arena Physica
          </span>
        </div>
        <div className="flex items-center gap-6">
          <p className="text-sm text-[#6b6860]">
            Welcome, <span className="text-[#1a1a1a] font-medium">{firstName}</span>
          </p>
          <button
            onClick={() => signOut()}
            className="text-xs tracking-widest text-[#a09e97] uppercase hover:text-[#6b6860] transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-8 py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
          {/* Left — Tools */}
          <div className="lg:col-span-3">
            <h2 className="mb-1 text-xs tracking-widest text-[#a09e97] uppercase">
              Tools
            </h2>
            <p className="mb-6 text-sm text-[#6b6860]">
              Quick access to your most-used workflows
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <button
                  key={tool.name}
                  className="group flex flex-col gap-3 border border-[#d9d5cc] bg-white p-6 text-left transition-all duration-200 hover:border-[#4a5540]/40 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[#4a5540]">{tool.icon}</div>
                    <h3 className="text-sm font-medium text-[#1a1a1a]">
                      {tool.name}
                    </h3>
                  </div>
                  <p className="text-xs leading-relaxed text-[#a09e97]">
                    {tool.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Right — Upcoming Events */}
          <div className="lg:col-span-2">
            <h2 className="mb-1 text-xs tracking-widest text-[#a09e97] uppercase">
              Upcoming
            </h2>
            <p className="mb-6 text-sm text-[#6b6860]">Today&apos;s schedule</p>
            <div className="flex flex-col gap-3">
              {upcomingEvents.map((event, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 border border-[#d9d5cc] bg-white p-4 transition-all duration-200 hover:border-[#4a5540]/40"
                >
                  <span className="mt-0.5 whitespace-nowrap font-mono text-xs text-[#a09e97]">
                    {event.time}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-medium text-[#1a1a1a]">
                      {event.title}
                    </p>
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        tagColors[event.tag] || "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {event.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
