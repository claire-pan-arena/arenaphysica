"use client";

import { useEffect, useState, useCallback } from "react";
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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ENTRY_TYPES = [
  { value: "travel", label: "Travel" },
  { value: "ooo", label: "OOO" },
];

function getCellStyle(entryType: string) {
  switch (entryType) {
    case "travel":
      return "bg-[#a3b18a]/20 border border-[#a3b18a]/30 text-[#a3b18a]";
    case "ooo":
      return "bg-red-500/10 border border-red-500/20 text-red-300/60";
    default:
      return "bg-white/[0.05] text-white/30";
  }
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => formatDate(getMonday(new Date())));
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState<{ date: string } | null>(null);
  const [modalLocation, setModalLocation] = useState("");
  const [modalType, setModalType] = useState("travel");
  const [modalNote, setModalNote] = useState("");
  const [numWeeks, setNumWeeks] = useState(2);
  const [suggestions, setSuggestions] = useState<TravelSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [orgPeople, setOrgPeople] = useState<{ email: string; name: string }[]>([]);
  const [addSearch, setAddSearch] = useState("");

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
        setLoadingSuggestions(false);
      })
      .catch(() => setLoadingSuggestions(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/team-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, weeks: numWeeks }),
      });
      fetchData();
    } catch {}
    setSyncing(false);
  };

  const handleAddEntry = async () => {
    if (!modal || !modalLocation.trim()) return;
    await fetch("/api/team-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: modal.date,
        location: modalLocation.trim(),
        entryType: modalType,
        note: modalNote.trim(),
      }),
    });
    setModal(null);
    setModalLocation("");
    setModalType("travel");
    setModalNote("");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/team-calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const handleOpenAddPerson = async () => {
    setShowAddPerson(true);
    setAddSearch("");
    try {
      const res = await fetch("/api/team-calendar/org");
      const data = await res.json();
      setOrgPeople(data.people || []);
    } catch {}
  };

  const handleSelectPerson = async (person: { email: string; name: string }) => {
    await fetch("/api/team-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_member", forName: person.name, forEmail: person.email }),
    });
    setShowAddPerson(false);
    setAddSearch("");
    fetchData();
  };

  const handleRemovePerson = async (email: string) => {
    await fetch("/api/team-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_member", forEmail: email }),
    });
    fetchData();
  };

  const handleConfirmSuggestion = async (suggestion: TravelSuggestion) => {
    setConfirmingId(suggestion.id);
    // Add an entry for each day in the range
    const start = new Date(suggestion.startDate + "T12:00:00");
    const end = new Date(suggestion.endDate + "T12:00:00");
    const d = new Date(start);
    while (d <= end) {
      await fetch("/api/team-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formatDate(d),
          location: suggestion.location,
          entryType: "travel",
          note: "",
        }),
      });
      d.setDate(d.getDate() + 1);
    }
    setConfirmingId(null);
    fetchData();
    fetchSuggestions();
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

  const today = () => {
    setWeekStart(formatDate(getMonday(new Date())));
  };

  // Build days array
  const days: Date[] = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < numWeeks * 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }

  const todayStr = formatDate(new Date());

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
            </div>
          </div>

          <div className="flex gap-8">
            {/* Left: Calendar grid */}
            <div className="flex-1 min-w-0">
              {/* Week navigation */}
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={prevWeek}
                  className="px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={today}
                  className="px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={nextWeek}
                  className="px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                >
                  Next
                </button>
                <span className="text-sm text-white/80 ml-2">
                  {formatWeekRange(startDate)}
                  {numWeeks > 1 && (() => {
                    const secondWeekStart = new Date(startDate);
                    secondWeekStart.setDate(startDate.getDate() + 7);
                    return ` - ${formatWeekRange(secondWeekStart)}`;
                  })()}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">View</span>
                  {[1, 2, 4].map((w) => (
                    <button
                      key={w}
                      onClick={() => setNumWeeks(w)}
                      className={`px-3 py-1.5 text-xs border transition-colors ${
                        numWeeks === w
                          ? "border-white/40 text-white bg-white/10"
                          : "border-white/10 text-white/40 hover:text-white hover:border-white/30"
                      }`}
                    >
                      {w}w
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar grid */}
              {loading ? (
                <p className="text-white/40 text-sm">Loading...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left text-[10px] tracking-widest uppercase text-white/40 px-3 py-2 w-[140px] sticky left-0 bg-[#1e2530] z-10">
                          Team
                        </th>
                        {days.map((day) => {
                          const isToday = formatDate(day) === todayStr;
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          const dayIdx = (day.getDay() + 6) % 7;
                          return (
                            <th
                              key={formatDate(day)}
                              className={`text-center text-[9px] tracking-wider uppercase px-0.5 py-1.5 min-w-[56px] ${
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
                        members.map((member) => (
                          <tr key={member.email} className="border-t border-white/[0.06]">
                            <td className="px-3 py-2 sticky left-0 bg-[#1e2530] z-10 group/name">
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
                            {days.map((day) => {
                              const dateStr = formatDate(day);
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                              const dayEntries = member.entries.filter((e) => e.date === dateStr);

                              return (
                                <td
                                  key={dateStr}
                                  className={`px-0.5 py-1 ${isWeekend ? "bg-white/[0.02]" : ""}`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    {dayEntries.map((entry) => (
                                      <div
                                        key={entry.id}
                                        className={`group relative px-1.5 py-0.5 rounded text-[10px] leading-tight ${getCellStyle(entry.entryType)}`}
                                        title={entry.note || entry.location}
                                      >
                                        <span className="truncate block">{entry.location.split(",")[0]}</span>
                                        <button
                                          onClick={() => handleDelete(entry.id)}
                                          className="absolute -top-1 -right-1 w-4 h-4 bg-white/10 rounded-full text-[10px] text-white/40 hover:text-white hover:bg-white/20 hidden group-hover:flex items-center justify-center"
                                        >
                                          x
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => {
                                        setModal({ date: dateStr });
                                        setModalLocation("");
                                        setModalType("travel");
                                        setModalNote("");
                                      }}
                                      className={`px-1 py-0.5 rounded text-[9px] text-white/10 hover:text-white/30 hover:bg-white/[0.05] transition-colors ${
                                        dayEntries.length === 0 ? "min-h-[22px]" : ""
                                      }`}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 text-[10px] text-white/40 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#a3b18a]/20 border border-[#a3b18a]/30" />
                  Travel
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
                <h2 className="text-[10px] tracking-widest uppercase text-white/40 mb-4">
                  Detected from your calendar
                </h2>

                {loadingSuggestions ? (
                  <p className="text-white/30 text-xs">Scanning calendar...</p>
                ) : suggestions.length === 0 ? (
                  <p className="text-white/30 text-xs">No upcoming travel detected.</p>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="border border-white/10 rounded-lg p-4 bg-white/[0.03]"
                      >
                        <div className="mb-3">
                          <div className="text-sm text-white/90 font-medium">{sug.location}</div>
                          <div className="text-xs text-white/40 mt-0.5">
                            {formatDateRange(sug.startDate, sug.endDate)}
                          </div>
                        </div>

                        {/* Confirm / Dismiss */}
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add entry modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e2530] border border-white/10 rounded-lg p-6 w-[400px]">
            <h3 className="text-sm text-white/80 mb-4">
              Add entry for {new Date(modal.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Location / City</label>
                <input
                  type="text"
                  value={modalLocation}
                  onChange={(e) => setModalLocation(e.target.value)}
                  placeholder="e.g. Los Angeles, SF, Austin"
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Type</label>
                <div className="flex gap-2">
                  {ENTRY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setModalType(t.value)}
                      className={`px-3 py-1.5 text-xs border rounded transition-colors ${
                        modalType === t.value
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
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="e.g. Anduril visit, team offsite"
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEntry}
                disabled={!modalLocation.trim()}
                className="px-4 py-2 text-xs text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors disabled:opacity-30"
              >
                Add
              </button>
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
            <div className="overflow-y-auto flex-1 -mx-1">
              {orgPeople
                .filter((p) => {
                  // Exclude people already on the calendar
                  if (members.some((m) => m.email === p.email)) return false;
                  if (!addSearch) return true;
                  const q = addSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
                })
                .map((person) => (
                  <button
                    key={person.email}
                    onClick={() => handleSelectPerson(person)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="text-sm text-white/80">{person.name}</div>
                    <div className="text-[11px] text-white/30">{person.email}</div>
                  </button>
                ))}
              {orgPeople.filter((p) => !members.some((m) => m.email === p.email)).length === 0 && (
                <p className="text-white/30 text-xs px-3 py-4 text-center">All team members already added.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
