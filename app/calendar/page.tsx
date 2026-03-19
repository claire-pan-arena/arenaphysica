"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import NavHeader from "../components/nav-header";

interface CalendarEntry {
  id: string;
  date: string;
  location: string;
  entryType: string;
  note: string;
  source: string;
}

interface TeamMember {
  email: string;
  name: string;
  entries: CalendarEntry[];
}

interface TravelSuggestion {
  id: string;
  location: string;
  startDate: string;
  endDate: string;
  events?: string[];
}

/** A group of consecutive same-location entries for one member */
interface EntrySpan {
  location: string;
  entryType: string;
  note: string;
  source: string;
  startDate: string;
  endDate: string;
  entryIds: string[];
  startIdx: number;
  span: number;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mMonth = monday.toLocaleDateString("en-US", { month: "short" });
  const sMonth = sunday.toLocaleDateString("en-US", { month: "short" });
  const year = monday.getFullYear();
  if (mMonth === sMonth) {
    return `${mMonth} ${monday.getDate()} - ${sunday.getDate()}, ${year}`;
  }
  return `${mMonth} ${monday.getDate()} - ${sMonth} ${sunday.getDate()}, ${year}`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  if (start === end) {
    return `${sMonth} ${s.getDate()}`;
  }
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()} - ${e.getDate()}`;
  }
  return `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}`;
}

/** Merge consecutive same-location entries into spans */
function buildSpans(entries: CalendarEntry[], dayDates: string[]): EntrySpan[] {
  const dateIndex = new Map<string, number>();
  dayDates.forEach((d, i) => dateIndex.set(d, i));

  // Group entries by date (only dates in our view range)
  const byDate = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    if (!dateIndex.has(e.date)) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }

  // Track which dates are consumed by a span
  const consumed = new Set<string>();
  const spans: EntrySpan[] = [];

  for (let i = 0; i < dayDates.length; i++) {
    const date = dayDates[i];
    const dayEntries = byDate.get(date) || [];

    for (const entry of dayEntries) {
      const key = `${entry.location}|${entry.entryType}`;
      if (consumed.has(`${date}|${key}`)) continue;

      // Extend forward while same location+type exists on consecutive days
      const ids = [entry.id];
      consumed.add(`${date}|${key}`);
      let endIdx = i;

      for (let j = i + 1; j < dayDates.length; j++) {
        const nextDate = dayDates[j];
        const nextEntries = byDate.get(nextDate) || [];
        const match = nextEntries.find(
          (e) => e.location === entry.location && e.entryType === entry.entryType && !consumed.has(`${nextDate}|${key}`)
        );
        if (match) {
          ids.push(match.id);
          consumed.add(`${nextDate}|${key}`);
          endIdx = j;
        } else {
          break;
        }
      }

      spans.push({
        location: entry.location,
        entryType: entry.entryType,
        note: entry.note,
        source: entry.source,
        startDate: date,
        endDate: dayDates[endIdx],
        entryIds: ids,
        startIdx: i,
        span: endIdx - i + 1,
      });
    }
  }

  return spans;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ENTRY_TYPES = [
  { value: "travel", label: "Travel" },
  { value: "deployment", label: "Deployment" },
  { value: "ooo", label: "OOO" },
];

function getCellStyle(entryType: string, source: string) {
  const isConfirmed = source === "manual" || source === "notion_ooo";
  const isDetected = source === "google_calendar" || source === "suggestion";

  if (entryType === "ooo") {
    if (isDetected) return "bg-red-500/10 border border-dashed border-red-500/20 text-red-300/50";
    return "bg-red-500/10 border border-red-500/20 text-red-300/60";
  }
  if (entryType === "deployment") {
    if (isDetected) return "bg-blue-500/10 border border-dashed border-blue-500/20 text-blue-400/50";
    return "bg-blue-500/15 border border-blue-500/25 text-blue-400/80";
  }
  if (isDetected) {
    // Auto-detected / suggested travel — amber/yellow
    return "bg-amber-500/15 border border-dashed border-amber-500/25 text-amber-400/80";
  }
  // Confirmed / manual travel — green
  return "bg-[#a3b18a]/20 border border-[#a3b18a]/30 text-[#a3b18a]";
}

interface ModalState {
  memberEmail: string;
  memberName?: string;
  additionalMembers: { email: string; name: string }[];
  location: string;
  entryType: string;
  note: string;
  startDate: string;
  endDate: string;
  editIds?: string[]; // existing entry IDs being edited
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => formatDate(getMonday(new Date())));
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [numWeeks, setNumWeeks] = useState(4);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<TravelSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [dragMemberIdx, setDragMemberIdx] = useState<number | null>(null);
  const [orgPeople, setOrgPeople] = useState<{ email: string; name: string }[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [addSelected, setAddSelected] = useState<{ email: string; name: string }[]>([]);
  const [sugLimit, setSugLimit] = useState(5);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sugUserEmail, setSugUserEmail] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/team-calendar?weekStart=${weekStart}&weeks=${numWeeks}`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [weekStart, numWeeks]);

  const fetchSuggestions = useCallback(() => {
    setLoadingSuggestions(true);
    fetch("/api/team-calendar/suggestions")
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions || []);
        setSugUserEmail(data.userEmail || null);
        setLoadingSuggestions(false);
      })
      .catch(() => setLoadingSuggestions(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  // Auto-sync on page load and every 10 minutes
  const hasSyncedOnLoad = useRef(false);
  useEffect(() => {
    const doSync = () => {
      fetch("/api/team-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, weeks: numWeeks }),
      }).then(() => { fetchData(); fetchSuggestions(); }).catch(() => {});
    };
    if (!hasSyncedOnLoad.current) {
      hasSyncedOnLoad.current = true;
      doSync();
    }
    const interval = setInterval(doSync, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [weekStart, numWeeks, fetchData, fetchSuggestions]);

  // Infinite scroll: load more weeks when near right edge
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 200;
      if (nearEnd) {
        setNumWeeks((prev) => prev + 4);
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/team-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, weeks: numWeeks }),
      });
      const data = await res.json();
      const ooo = data.notionOOO;
      if (ooo?.error) {
        setSyncResult(`OOO sync error: ${ooo.error}`);
      } else if (ooo) {
        setSyncResult(`Synced ${data.synced} calendars, ${ooo.synced} OOO days from ${ooo.total} Notion entries${ooo.names ? ` (unmatched: ${ooo.names.join(", ")})` : ""}`);
      }
      fetchData();
      fetchSuggestions();
    } catch {}
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 8000);
  };

  const handleSaveEntry = async () => {
    if (!modal || !modal.location.trim()) return;

    // Delete old entries if editing
    if (modal.editIds) {
      for (const id of modal.editIds) {
        await fetch("/api/team-calendar", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      }
    }

    // All people to create entries for: primary + additional
    const people = [
      { email: modal.memberEmail, name: modal.memberName },
      ...modal.additionalMembers,
    ];

    for (const person of people) {
      const start = new Date(modal.startDate + "T12:00:00");
      const end = new Date(modal.endDate + "T12:00:00");
      const d = new Date(start);
      while (d <= end) {
        await fetch("/api/team-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: formatDate(d),
            location: modal.location.trim(),
            entryType: modal.entryType,
            note: modal.note.trim(),
            forEmail: person.email,
            forName: person.name,
          }),
        });
        d.setDate(d.getDate() + 1);
      }
    }

    setModal(null);
    fetchData();
    fetchSuggestions();
  };

  const handleConfirmSpan = async (entryIds: string[]) => {
    for (const id of entryIds) {
      await fetch("/api/team-calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, source: "manual" }),
      });
    }
    fetchData();
    fetchSuggestions();
  };

  const handleDeleteSpan = async (entryIds: string[]) => {
    for (const id of entryIds) {
      await fetch("/api/team-calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    }
    fetchData();
  };

  const handleOpenAddPerson = async () => {
    setShowAddPerson(true);
    setAddSearch("");
    setAddSelected([]);
    try {
      const res = await fetch("/api/team-calendar/org");
      const data = await res.json();
      setOrgPeople(data.people || []);
    } catch {}
  };

  const toggleAddPerson = (person: { email: string; name: string }) => {
    setAddSelected((prev) =>
      prev.some((p) => p.email === person.email)
        ? prev.filter((p) => p.email !== person.email)
        : [...prev, person]
    );
  };

  const handleAddSelectedPeople = async () => {
    for (const person of addSelected) {
      await fetch("/api/team-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_member", forName: person.name, forEmail: person.email }),
      });
    }
    setShowAddPerson(false);
    setAddSearch("");
    setAddSelected([]);
    fetchData();
  };

  const handleReorderMember = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...members];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setMembers(reordered);
    // Persist new order
    await fetch("/api/team-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", order: reordered.map((m) => m.email) }),
    });
  };

  const handleRemovePerson = async (email: string) => {
    await fetch("/api/team-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_member", forEmail: email }),
    });
    fetchData();
  };

  const handleConfirmSuggestion = (suggestion: TravelSuggestion) => {
    // Find the current user in the members list
    const currentMember = sugUserEmail ? members.find((m) => m.email === sugUserEmail) : null;
    // Open edit modal pre-filled with suggestion data so user can adjust
    setModal({
      memberEmail: currentMember?.email || sugUserEmail || "",
      memberName: currentMember?.name,
      additionalMembers: [],
      location: suggestion.location,
      entryType: "travel",
      note: "",
      startDate: suggestion.startDate,
      endDate: suggestion.endDate,
    });
    // Remove from suggestions list
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

  const handleDismissSuggestion = (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(formatDate(d));
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(formatDate(d));
  };
  const today = () => setWeekStart(formatDate(getMonday(new Date())));

  // Build days array
  const days: Date[] = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < numWeeks * 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  const dayDates = days.map(formatDate);
  const todayStr = formatDate(new Date());

  // Merge suggestions into members as synthetic amber entries for the grid
  const membersWithSuggestions = members.map((member) => {
    if (!sugUserEmail || member.email !== sugUserEmail || suggestions.length === 0) return member;

    // Build set of dates+locations already covered by real entries
    const existingSet = new Set(member.entries.map((e) => `${e.date}|${e.location}`));

    const syntheticEntries: CalendarEntry[] = [];
    for (const sug of suggestions) {
      const d = new Date(sug.startDate + "T12:00:00");
      const end = new Date(sug.endDate + "T12:00:00");
      while (d <= end) {
        const dateStr = formatDate(d);
        if (!existingSet.has(`${dateStr}|${sug.location}`)) {
          syntheticEntries.push({
            id: `${sug.id}-${dateStr}`,
            date: dateStr,
            location: sug.location,
            entryType: "travel",
            note: "",
            source: "suggestion",
          });
        }
        d.setDate(d.getDate() + 1);
      }
    }

    if (syntheticEntries.length === 0) return member;
    return { ...member, entries: [...member.entries, ...syntheticEntries] };
  });

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a3040] via-[#1e2530] to-[#141820]" />

      {/* Wireframe sphere */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 400 400" className="h-[700px] w-[700px] animate-[spin_25s_linear_infinite] opacity-[0.04]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.5" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.5" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.5" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.5" transform="rotate(120 200 200)" />
        </svg>
      </div>

      <div className="relative z-10">
        <NavHeader />

        <div className="mx-auto max-w-[1600px] px-8 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1
              className="text-3xl tracking-tight"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Team Calendar
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenAddPerson}
                className="px-4 py-2 text-[10px] tracking-widest uppercase border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors"
              >
                Add Person
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 text-[10px] tracking-widest uppercase border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                {syncing ? "Syncing..." : "Sync Calendars"}
              </button>
              {syncResult && (
                <span className="text-[10px] text-white/40">{syncResult}</span>
              )}
            </div>
          </div>

          <div className="flex gap-8">
            {/* Left: Calendar grid */}
            <div className="flex-1 min-w-0">
              {/* Week navigation */}
              <div className="flex items-center gap-4 mb-6">
                <button onClick={today} className="px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-colors">
                  Today
                </button>
                <label className="relative cursor-pointer">
                  <span className="text-sm text-white/80 hover:text-white transition-colors underline decoration-white/20 underline-offset-4">
                    {formatWeekRange(startDate)}
                  </span>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => {
                      if (e.target.value) {
                        const d = new Date(e.target.value + "T12:00:00");
                        setWeekStart(formatDate(getMonday(d)));
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]"
                  />
                </label>
                <button onClick={prevWeek} className="px-2 py-1 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-colors">
                  &larr;
                </button>
                <button onClick={nextWeek} className="px-2 py-1 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-colors">
                  &rarr;
                </button>
              </div>

              {/* Calendar grid */}
              {loading ? (
                <p className="text-white/40 text-sm">Loading...</p>
              ) : (
                <div className="overflow-x-auto" ref={scrollRef}>
                  <table className="w-full border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[100px]" />
                      {days.map((day) => (
                        <col key={formatDate(day)} className="w-[80px]" />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="text-left text-[10px] tracking-widest uppercase text-white/40 px-2 py-2 sticky left-0 bg-[#1e2530] z-10">
                          Team
                        </th>
                        {days.map((day) => {
                          const isToday = formatDate(day) === todayStr;
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          const dayIdx = (day.getDay() + 6) % 7;
                          return (
                            <th
                              key={formatDate(day)}
                              className={`text-center text-[9px] tracking-wider uppercase px-0.5 py-1.5 ${
                                isToday ? "text-white" : isWeekend ? "text-white/20" : "text-white/40"
                              }`}
                            >
                              <div>{DAY_LABELS[dayIdx]}</div>
                              <div className={`text-xs mt-0.5 ${isToday ? "text-white font-medium" : ""}`}>
                                {formatDisplayDate(day)}
                              </div>
                              {isToday && <div className="h-[2px] bg-[#a3b18a] mt-1 rounded" />}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr>
                          <td colSpan={days.length + 1} className="text-center text-white/30 text-sm py-12">
                            No team members yet. Team members appear once they sign in.
                          </td>
                        </tr>
                      ) : (
                        membersWithSuggestions.map((member, memberIdx) => {
                          const spans = buildSpans(member.entries, dayDates);
                          // Build a map: column index -> span (only for the first column of each span)
                          const spanAt = new Map<number, EntrySpan>();
                          const consumed = new Set<number>();
                          for (const s of spans) {
                            spanAt.set(s.startIdx, s);
                            for (let c = s.startIdx; c < s.startIdx + s.span; c++) {
                              if (c !== s.startIdx) consumed.add(c);
                            }
                          }

                          return (
                            <tr key={member.email} className="border-t border-white/[0.06]">
                              <td
                                className={`px-2 py-2 sticky left-0 bg-[#1e2530] z-10 group/name cursor-grab ${dragMemberIdx !== null && dragMemberIdx !== memberIdx ? "border-t border-transparent" : ""}`}
                                draggable
                                onDragStart={() => setDragMemberIdx(memberIdx)}
                                onDragEnd={() => setDragMemberIdx(null)}
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-t-white/40"); }}
                                onDragLeave={(e) => { e.currentTarget.classList.remove("border-t-white/40"); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove("border-t-white/40");
                                  if (dragMemberIdx !== null) handleReorderMember(dragMemberIdx, memberIdx);
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-white/80">{member.name.split(" ")[0]}</span>
                                  <button
                                    onClick={() => handleRemovePerson(member.email)}
                                    className="w-3.5 h-3.5 text-[9px] text-white/20 hover:text-white/50 hidden group-hover/name:inline-flex items-center justify-center"
                                    title="Remove from calendar"
                                  >
                                    x
                                  </button>
                                </div>
                              </td>
                              {days.map((day, colIdx) => {
                                if (consumed.has(colIdx)) return null; // consumed by a span

                                const span = spanAt.get(colIdx);
                                const dateStr = dayDates[colIdx];
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                                if (span) {
                                  return (
                                    <td
                                      key={dateStr}
                                      colSpan={span.span}
                                      className="px-0.5 py-1"
                                    >
                                      <div
                                        onClick={() => setModal({
                                          memberEmail: member.email,
                                          memberName: member.name,
                                          additionalMembers: [],
                                          location: span.location,
                                          entryType: span.entryType,
                                          note: span.note || "",
                                          startDate: span.startDate,
                                          endDate: span.endDate,
                                          editIds: span.source === "suggestion" ? undefined : span.entryIds,
                                        })}
                                        className={`group relative px-2 py-1.5 rounded text-[11px] leading-tight cursor-pointer text-center ${getCellStyle(span.entryType, span.source)}`}
                                        title={span.note || `${span.location} (${formatDateRange(span.startDate, span.endDate)})`}
                                      >
                                        <span className="block truncate">{span.location}</span>
                                        {span.span > 1 && (
                                          <span className="block text-[9px] opacity-60 mt-0.5">
                                            {formatDateRange(span.startDate, span.endDate)}
                                          </span>
                                        )}
                                        {(span.source === "google_calendar" || span.source === "suggestion") && (
                                          <div className="hidden group-hover:flex absolute bottom-0.5 right-1 gap-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (span.source === "suggestion") {
                                                  setModal({
                                                    memberEmail: member.email,
                                                    memberName: member.name,
                                                    additionalMembers: [],
                                                    location: span.location,
                                                    entryType: span.entryType,
                                                    note: "",
                                                    startDate: span.startDate,
                                                    endDate: span.endDate,
                                                  });
                                                } else {
                                                  handleConfirmSpan(span.entryIds);
                                                }
                                              }}
                                              className="text-[10px] leading-none text-[#a3b18a]/60 hover:text-[#a3b18a] transition-colors"
                                              title="Confirm"
                                            >
                                              &#10003;
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (span.source === "suggestion") {
                                                  setSuggestions((prev) => prev.filter((s) => !(s.location === span.location && s.startDate === span.startDate)));
                                                } else {
                                                  handleDeleteSpan(span.entryIds);
                                                }
                                              }}
                                              className="text-[10px] leading-none text-white/20 hover:text-red-400/70 transition-colors"
                                              title={span.source === "suggestion" ? "Dismiss" : "Remove"}
                                            >
                                              &#10005;
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                }

                                // Empty cell
                                return (
                                  <td
                                    key={dateStr}
                                    className={`px-0.5 py-1 ${isWeekend ? "bg-white/[0.02]" : ""}`}
                                  >
                                    <button
                                      onClick={() => setModal({
                                        memberEmail: member.email,
                                        memberName: member.name,
                                        additionalMembers: [],
                                        location: "",
                                        entryType: "travel",
                                        note: "",
                                        startDate: dateStr,
                                        endDate: dateStr,
                                      })}
                                      className="w-full px-1 py-0.5 rounded text-[9px] text-white/10 hover:text-white/30 hover:bg-white/[0.05] transition-colors min-h-[28px]"
                                    >
                                      +
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 text-[10px] text-white/40 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#a3b18a]/20 border border-[#a3b18a]/30" />
                  Confirmed
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500/15 border border-amber-500/25" />
                  Detected
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500/15 border border-blue-500/25" />
                  Deployment
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20" />
                  OOO
                </div>
              </div>
            </div>

            {/* Right: Suggestions panel */}
            <div className="w-[320px] shrink-0">
              <div className="sticky top-20">
                <div className="mb-4">
                  <h2 className="text-[10px] tracking-widest uppercase text-white/40">
                    Detected from your calendar
                  </h2>
                </div>

                {loadingSuggestions ? (
                  <p className="text-white/30 text-xs">Scanning calendar...</p>
                ) : suggestions.length === 0 ? (
                  <p className="text-white/30 text-xs">No upcoming travel detected.</p>
                ) : (
                  <div className="space-y-3">
                    {suggestions.slice(0, sugLimit).map((sug) => (
                      <div
                        key={sug.id}
                        className="border border-white/10 rounded-lg p-4 bg-white/[0.03]"
                      >
                        <div className="mb-3">
                          <div className="text-sm text-white/90 font-medium">{sug.location}</div>
                          <div className="text-xs text-white/40 mt-0.5">
                            {formatDateRange(sug.startDate, sug.endDate)}
                          </div>
                          {sug.events && sug.events.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {sug.events.map((ev, i) => (
                                <div key={i} className="text-[11px] text-white/30 truncate">{ev}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirmSuggestion(sug)}
                            disabled={confirmingId === sug.id}
                            className="flex-1 px-3 py-1.5 text-[10px] tracking-widest uppercase text-[#a3b18a] border border-[#a3b18a]/30 hover:bg-[#a3b18a]/10 transition-colors disabled:opacity-40"
                          >
                            {confirmingId === sug.id ? "Adding..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => handleDismissSuggestion(sug.id)}
                            className="px-3 py-1.5 text-[10px] tracking-widest uppercase text-white/30 border border-white/10 hover:text-white/50 hover:border-white/20 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                    {suggestions.length > sugLimit && (
                      <button
                        onClick={() => setSugLimit((prev) => prev + 5)}
                        className="w-full py-2 text-[10px] tracking-widest uppercase text-white/30 hover:text-white/50 border border-white/10 hover:border-white/20 rounded transition-colors"
                      >
                        Show more ({suggestions.length - sugLimit} remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Entry modal (add / edit) */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e2530] border border-white/10 rounded-lg p-6 w-[420px]">
            <h3 className="text-sm text-white/80 mb-4">
              {modal.editIds ? "Edit entry" : "Add entry"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Location / City</label>
                <input
                  type="text"
                  value={modal.location}
                  onChange={(e) => setModal({ ...modal, location: e.target.value })}
                  placeholder="e.g. Los Angeles, California"
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Start date</label>
                  <input
                    type="date"
                    value={modal.startDate}
                    onChange={(e) => setModal({ ...modal, startDate: e.target.value, endDate: e.target.value > modal.endDate ? e.target.value : modal.endDate })}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">End date</label>
                  <input
                    type="date"
                    value={modal.endDate}
                    min={modal.startDate}
                    onChange={(e) => setModal({ ...modal, endDate: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Type</label>
                <div className="flex gap-2">
                  {ENTRY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setModal({ ...modal, entryType: t.value })}
                      className={`px-3 py-1.5 text-xs border rounded transition-colors ${
                        modal.entryType === t.value
                          ? "border-white/40 text-white bg-white/10"
                          : "border-white/10 text-white/40 hover:border-white/20"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={modal.note}
                  onChange={(e) => setModal({ ...modal, note: e.target.value })}
                  placeholder="e.g. Anduril visit, team offsite"
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
                />
              </div>

              {!modal.editIds && (
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Also add for</label>
                  {modal.additionalMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {modal.additionalMembers.map((p) => (
                        <span
                          key={p.email}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white/10 rounded text-white/70"
                        >
                          {p.name.split(" ")[0]}
                          <button
                            onClick={() => setModal({ ...modal, additionalMembers: modal.additionalMembers.filter((m) => m.email !== p.email) })}
                            className="text-white/30 hover:text-white/60"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select
                    value=""
                    onChange={(e) => {
                      const email = e.target.value;
                      if (!email) return;
                      const person = members.find((m) => m.email === email);
                      if (person && !modal.additionalMembers.some((m) => m.email === email)) {
                        setModal({ ...modal, additionalMembers: [...modal.additionalMembers, { email: person.email, name: person.name }] });
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white/40 focus:outline-none focus:border-white/30 [color-scheme:dark]"
                  >
                    <option value="">Select team member...</option>
                    {members
                      .filter((m) => m.email !== modal.memberEmail && !modal.additionalMembers.some((a) => a.email === m.email))
                      .map((m) => (
                        <option key={m.email} value={m.email}>{m.name}</option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <div>
                {modal.editIds && (
                  <button
                    onClick={() => { handleDeleteSpan(modal.editIds!); setModal(null); }}
                    className="px-4 py-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEntry}
                  disabled={!modal.location.trim()}
                  className="px-4 py-2 text-xs text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors disabled:opacity-30"
                >
                  {modal.editIds ? "Save" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Person dropdown */}
      {showAddPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddPerson(false)}>
          <div className="bg-[#1e2530] border border-white/10 rounded-lg p-4 w-[340px] max-h-[500px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search team members..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 mb-3"
              autoFocus
            />
            {addSelected.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {addSelected.map((p) => (
                  <span key={p.email} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white/10 rounded text-white/70">
                    {p.name.split(" ")[0]}
                    <button onClick={() => toggleAddPerson(p)} className="text-white/30 hover:text-white/60">x</button>
                  </span>
                ))}
              </div>
            )}
            <div className="overflow-y-auto flex-1 -mx-1">
              {orgPeople
                .filter((p) => {
                  if (members.some((m) => m.email === p.email)) return false;
                  if (!addSearch) return true;
                  const q = addSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
                })
                .map((person) => {
                  const selected = addSelected.some((p) => p.email === person.email);
                  return (
                    <button
                      key={person.email}
                      onClick={() => toggleAddPerson(person)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-white/[0.08] transition-colors flex items-center gap-2 ${selected ? "bg-white/[0.06]" : ""}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${selected ? "border-[#a3b18a] bg-[#a3b18a]/20 text-[#a3b18a]" : "border-white/20"}`}>
                        {selected && "\u2713"}
                      </div>
                      <div>
                        <div className="text-sm text-white/80">{person.name}</div>
                        <div className="text-[11px] text-white/30">{person.email}</div>
                      </div>
                    </button>
                  );
                })}
              {orgPeople.filter((p) => !members.some((m) => m.email === p.email)).length === 0 && (
                <p className="text-white/30 text-xs px-3 py-4 text-center">All team members already added.</p>
              )}
            </div>
            {addSelected.length > 0 && (
              <button
                onClick={handleAddSelectedPeople}
                className="mt-3 w-full py-2 text-[10px] tracking-widest uppercase text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors"
              >
                Add {addSelected.length} {addSelected.length === 1 ? "person" : "people"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
