"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Layers,
  LayoutDashboard,
  Rocket,
  Users,
  CalendarDays,
  ListChecks,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import CommandCenter from "./views/command-center";
import DeploymentsView from "./views/deployments";
import PeopleView from "./views/people";
import MeetingsView from "./views/meetings";
import BacklogView from "./views/backlog";
import SettingsView from "./views/settings";
import CoPilotPanel from "./views/copilot";

type View = "command" | "deployments" | "people" | "meetings" | "backlog" | "settings";

const NAV_ITEMS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: "command", label: "Command Center", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "deployments", label: "Deployments", icon: <Rocket className="w-4 h-4" /> },
  { key: "people", label: "People", icon: <Users className="w-4 h-4" /> },
  { key: "meetings", label: "Meetings", icon: <CalendarDays className="w-4 h-4" /> },
  { key: "backlog", label: "Backlog & Sprint", icon: <ListChecks className="w-4 h-4" /> },
  { key: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function viewTitle(view: View): string {
  switch (view) {
    case "command": return "Command Center";
    case "deployments": return "Deployments";
    case "people": return "People";
    case "meetings": return "Meetings";
    case "backlog": return "Backlog & Sprint";
    case "settings": return "Settings";
  }
}

export default function DSDashboard({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string;
}) {
  const [currentView, setCurrentView] = useState<View>("command");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInitialMessage, setCopilotInitialMessage] = useState<string | null>(null);
  const [filterCompany, setFilterCompany] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const openCopilotWithMessage = useCallback((msg: string) => {
    setCopilotInitialMessage(msg);
    setCopilotOpen(true);
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside
        className="flex flex-col shrink-0"
        style={{ width: 220, backgroundColor: "#0f0f23" }}
      >
        {/* Back link */}
        <Link
          href="/"
          className="flex items-center gap-1.5 px-5 pt-4 pb-2 text-[10px] tracking-widest text-white/40 uppercase hover:text-white/70 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
          Ground Control
        </Link>

        {/* Logo area */}
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white tracking-wide">Arena DS</span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-3 mt-2 flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
                currentView === item.key
                  ? "bg-[#1e1b4b] text-white font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Filter dropdowns */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div>
            <label className="text-[9px] tracking-widest text-white/30 uppercase mb-1 block">
              Company
            </label>
            <div className="relative">
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="w-full appearance-none rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 outline-none focus:border-white/20"
              >
                <option value="">All Companies</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[9px] tracking-widest text-white/30 uppercase mb-1 block">
              Group
            </label>
            <div className="relative">
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full appearance-none rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70 outline-none focus:border-white/20"
              >
                <option value="">All Groups</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Co-Pilot toggle */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] transition-all ${
              copilotOpen
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Co-Pilot
          </button>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top header bar */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shrink-0">
          <h1 className="text-base font-semibold text-gray-900">
            {viewTitle(currentView)}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">{today}</span>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-[11px] font-semibold">
              {getInitials(userName)}
            </div>
          </div>
        </header>

        {/* Content + optional copilot */}
        <div className="flex flex-1 overflow-hidden">
          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-6">
            {currentView === "command" && (
              <CommandCenter
                key={refreshKey}
                filterCompany={filterCompany}
                filterGroup={filterGroup}
                onNavigate={setCurrentView}
                onRefresh={triggerRefresh}
              />
            )}
            {currentView === "deployments" && (
              <DeploymentsView
                key={refreshKey}
                filterCompany={filterCompany}
                onRefresh={triggerRefresh}
              />
            )}
            {currentView === "people" && (
              <PeopleView
                key={refreshKey}
                filterCompany={filterCompany}
                filterGroup={filterGroup}
                onRefresh={triggerRefresh}
              />
            )}
            {currentView === "meetings" && (
              <MeetingsView
                key={refreshKey}
                filterCompany={filterCompany}
                filterGroup={filterGroup}
                onRefresh={triggerRefresh}
                onOpenCopilot={openCopilotWithMessage}
              />
            )}
            {currentView === "backlog" && (
              <BacklogView
                key={refreshKey}
                filterCompany={filterCompany}
                filterGroup={filterGroup}
                onRefresh={triggerRefresh}
              />
            )}
            {currentView === "settings" && (
              <SettingsView
                key={refreshKey}
                onRefresh={triggerRefresh}
              />
            )}
          </main>

          {/* Co-Pilot panel */}
          {copilotOpen && (
            <CoPilotPanel
              onClose={() => {
                setCopilotOpen(false);
                setCopilotInitialMessage(null);
              }}
              initialMessage={copilotInitialMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
