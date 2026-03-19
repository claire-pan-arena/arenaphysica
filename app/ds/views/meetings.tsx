"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CalendarDays,
  Users,
  Zap,
  Shield,
  CheckCircle2,
  Circle,
  Plus,
  BarChart3,
  ExternalLink,
  Star,
  Clock,
  AlertCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Link as LinkIcon,
  PenLine,
} from "lucide-react";
import {
  Card,
  SectionHeader,
  SentimentBadge,
  HealthDot,
  StatusBadge,
  Badge,
  Modal,
  EmptyState,
  type Meeting,
  type MeetingActionItem,
} from "../components/shared";
import { MeetingForm, PersonForm } from "./crud-modals";

interface Props {
  filterCompany: string;
  filterGroup: string;
  onRefresh: () => void;
  onOpenCopilot?: (msg: string) => void;
}

interface PrepContext {
  lastMeetingDate: string | null;
  lastMeetingSentiment: string | null;
  openActionItems: { title: string; owner: string }[];
  deploymentHealth: string | null;
  deploymentStatus: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  date: string;
  isoDate: string;
  startTimestamp: number;
  location: string | null;
  attendees: { email: string; name: string; isExternal: boolean; personId?: string; isChampion?: boolean }[];
  attendeeCount: number;
  externalCount: number;
  hasExternal: boolean;
  isLogged: boolean;
  isPast: boolean;
  suggestedDeploymentId: string | null;
  suggestedDeploymentName: string | null;
  prepContext: PrepContext | null;
}

interface UnmappedPerson {
  name: string;
  email: string;
  domain: string;
  meetingCount: number;
}

type Tab = "needs_logging" | "upcoming" | "logged" | "unmapped";

export default function MeetingsView({ filterCompany, filterGroup, onRefresh, onOpenCopilot }: Props) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [prefillMeeting, setPrefillMeeting] = useState<Partial<Meeting> | null>(null);
  const [unmappedPeople, setUnmappedPeople] = useState<UnmappedPerson[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [notionUrl, setNotionUrl] = useState<string>("");
  const [notionEventId, setNotionEventId] = useState<string | null>(null);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [prefillPerson, setPrefillPerson] = useState<{ name: string; email: string } | null>(null);

  const fetchMeetings = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompany) params.set("company", filterCompany);
    if (filterGroup) params.set("group", filterGroup);
    fetch(`/api/ds/meetings?${params}`)
      .then((r) => r.json())
      .then((d) => setMeetings(d.meetings || d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchCalendar = () => {
    setCalendarLoading(true);
    setCalendarError(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/ds/calendar?tz=${encodeURIComponent(tz)}&days=14&past=true`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error === "reauth") {
          setCalendarError("Calendar access expired. Please sign out and back in to re-authorize Google Calendar.");
        } else if (d.error) {
          setCalendarError(d.message || d.error);
        } else {
          setCalendarEvents(d.events || []);
          setUnmappedPeople(d.unmappedPeople || []);
        }
      })
      .catch((e) => setCalendarError(e.message))
      .finally(() => setCalendarLoading(false));
  };

  useEffect(() => {
    fetchMeetings();
    fetchCalendar();
  }, [filterCompany, filterGroup]);

  // Auto-select "needs_logging" tab if there are unlogged past meetings
  useEffect(() => {
    if (!calendarLoading) {
      const nl = calendarEvents.filter((e) => e.isPast && !e.isLogged);
      if (nl.length > 0) setActiveTab("needs_logging");
    }
  }, [calendarLoading, calendarEvents]);

  const handleSaved = () => {
    fetchMeetings();
    fetchCalendar();
    onRefresh();
    setShowForm(false);
    setEditMeeting(null);
    setPrefillMeeting(null);
  };

  const logFromCalendar = (event: CalendarEvent) => {
    const externalAttendees = event.attendees
      .filter((a) => a.isExternal)
      .map((a) => a.name);
    setPrefillMeeting({
      date: event.isoDate,
      type: "ad_hoc",
      attendees: externalAttendees,
      notes: `Calendar event: ${event.title}\nTime: ${event.time}\n${event.location ? `Location: ${event.location}\n` : ""}`,
      deployment_id: event.suggestedDeploymentId || undefined,
    } as any);
    setShowForm(true);
  };

  const importNotion = (event: CalendarEvent) => {
    setNotionEventId(event.id);
    setNotionUrl("");
  };

  const submitNotionImport = (event: CalendarEvent) => {
    if (!notionUrl.trim() || !onOpenCopilot) return;
    const msg = `Import meeting notes from Notion for the meeting "${event.title}" on ${event.date}.\n\nNotion URL: ${notionUrl.trim()}\n\nSuggested deployment: ${event.suggestedDeploymentName || "Unknown"}`;
    onOpenCopilot(msg);
    setNotionEventId(null);
    setNotionUrl("");
  };

  const addAsContact = (person: UnmappedPerson) => {
    setPrefillPerson({ name: person.name, email: person.email });
    setShowPersonForm(true);
  };

  // Derive sections from calendar events
  const needsLogging = useMemo(
    () => calendarEvents.filter((e) => e.isPast && !e.isLogged).sort((a, b) => a.startTimestamp - b.startTimestamp),
    [calendarEvents]
  );
  const upcoming = useMemo(
    () => calendarEvents.filter((e) => !e.isPast).sort((a, b) => a.startTimestamp - b.startTimestamp),
    [calendarEvents]
  );
  const recentlyLogged = useMemo(
    () => [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20),
    [meetings]
  );

  // Group unmapped people by domain
  const unmappedByDomain = useMemo(() => {
    const map: Record<string, UnmappedPerson[]> = {};
    for (const p of unmappedPeople) {
      if (!map[p.domain]) map[p.domain] = [];
      map[p.domain].push(p);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [unmappedPeople]);

  // ─── Week Calendar Strip ───
  const now = new Date();
  const getWeekStart = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1 + offset * 7); // Monday
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const weekStart = getWeekStart(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekLabel = (() => {
    const ws = weekDays[0];
    const we = weekDays[6];
    const monthStart = ws.toLocaleDateString("en-US", { month: "short" });
    const monthEnd = we.toLocaleDateString("en-US", { month: "short" });
    if (monthStart === monthEnd) {
      return `${monthStart} ${ws.getDate()}\u2013${we.getDate()}, ${ws.getFullYear()}`;
    }
    return `${monthStart} ${ws.getDate()} \u2013 ${monthEnd} ${we.getDate()}, ${ws.getFullYear()}`;
  })();

  // Count meetings per day
  const dayMeetingCounts = useMemo(() => {
    const counts: Record<string, { needs: number; upcoming: number; logged: number }> = {};
    for (const day of weekDays) {
      const isoDate = day.toLocaleDateString("en-CA");
      counts[isoDate] = { needs: 0, upcoming: 0, logged: 0 };
    }
    for (const e of calendarEvents) {
      if (counts[e.isoDate]) {
        if (e.isPast && !e.isLogged) counts[e.isoDate].needs++;
        else if (!e.isPast) counts[e.isoDate].upcoming++;
        else counts[e.isoDate].logged++;
      }
    }
    return counts;
  }, [calendarEvents, weekDays]);

  const todayISO = now.toLocaleDateString("en-CA");

  // Urgency helper for needs-logging cards
  const getUrgency = (event: CalendarEvent) => {
    const hoursAgo = (Date.now() - event.startTimestamp) / 3600000;
    if (hoursAgo > 48) return { label: `${Math.floor(hoursAgo / 24)}d ago`, color: "#ef4444", bg: "#fef2f2" };
    if (hoursAgo > 24) return { label: "Overdue", color: "#f59e0b", bg: "#fffbeb" };
    return { label: "Log today", color: "#6b7280", bg: "#f3f4f6" };
  };

  const isLoading = loading && calendarLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-4 animate-pulse">
            <div className="h-4 w-40 rounded bg-gray-100 mb-3" />
            <div className="h-3 w-56 rounded bg-gray-50" />
          </div>
        ))}
      </div>
    );
  }

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key: "needs_logging", label: "Needs Logging", count: needsLogging.length, color: "#f59e0b" },
    { key: "upcoming", label: "Upcoming", count: upcoming.length, color: "#6366f1" },
    { key: "logged", label: "Logged", count: recentlyLogged.length, color: "#16a34a" },
    { key: "unmapped", label: "Unmapped People", count: unmappedPeople.length, color: "#8b5cf6" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Meetings</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Log Meeting
        </button>
      </div>

      {/* Calendar error state */}
      {calendarError && (
        <Card className="mb-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Calendar Access Required</span>
          </div>
          <p className="text-[12px] text-gray-600 mb-3">{calendarError}</p>
          <a
            href="/api/auth/signout"
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Sign Out to Re-authorize
          </a>
        </Card>
      )}

      {/* ─── Week Calendar Strip ─── */}
      <div className="bg-white rounded-[10px] border border-gray-200 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-800">{weekLabel}</span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const iso = day.toLocaleDateString("en-CA");
            const counts = dayMeetingCounts[iso] || { needs: 0, upcoming: 0, logged: 0 };
            const total = counts.needs + counts.upcoming + counts.logged;
            const isToday = iso === todayISO;
            const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = day.getDate();

            return (
              <div
                key={iso}
                className={`flex flex-col items-center py-2 rounded-lg transition-colors ${
                  isToday ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-50"
                }`}
              >
                <span className={`text-[10px] uppercase tracking-wide ${isToday ? "text-indigo-600 font-semibold" : "text-gray-400"}`}>
                  {dayName}
                </span>
                <span className={`text-sm font-medium mb-1 ${isToday ? "text-indigo-700" : "text-gray-700"}`}>
                  {dayNum}
                </span>
                {total > 0 && (
                  <div className="flex items-center gap-0.5">
                    {counts.needs > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title={`${counts.needs} needs logging`} />
                    )}
                    {counts.upcoming > 0 && (
                      <span className="w-2 h-2 rounded-full bg-indigo-400" title={`${counts.upcoming} upcoming`} />
                    )}
                    {counts.logged > 0 && (
                      <span className="w-2 h-2 rounded-full bg-green-400" title={`${counts.logged} logged`} />
                    )}
                  </div>
                )}
                {total > 0 && (
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    {total} mtg{total !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              activeTab === tab.key
                ? "text-white shadow-sm"
                : "text-gray-600 bg-white border border-gray-200 hover:border-gray-300"
            }`}
            style={activeTab === tab.key ? { backgroundColor: tab.color } : undefined}
          >
            {tab.label}
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Tab Content: Needs Logging ─── */}
      {activeTab === "needs_logging" && (
        <div className="flex flex-col gap-3">
          {needsLogging.length === 0 ? (
            <Card>
              <EmptyState icon={<CheckCircle2 className="w-10 h-10 mb-3 text-green-400" />} message="All caught up! No meetings need logging." />
            </Card>
          ) : (
            needsLogging.map((event) => {
              const urgency = getUrgency(event);
              const externalAttendees = event.attendees.filter((a) => a.isExternal);
              const isImporting = notionEventId === event.id;

              return (
                <Card key={event.id} borderLeft="#f59e0b">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{event.title}</span>
                      <Badge color={urgency.color} bg={urgency.bg}>{urgency.label}</Badge>
                      {event.suggestedDeploymentName && (
                        <Badge color="#6366f1" bg="#eef2ff">{event.suggestedDeploymentName}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <Clock className="w-3 h-3" />
                      {event.date} at {event.time}
                    </div>
                  </div>

                  {/* Attendees */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {externalAttendees.map((att, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                          att.personId
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}
                      >
                        {att.isChampion && <Star className="w-2.5 h-2.5 text-amber-400" />}
                        {att.name}
                        {att.personId && " \u2713"}
                      </span>
                    ))}
                    {event.attendeeCount - externalAttendees.length > 0 && (
                      <span className="text-[10px] text-gray-400">
                        + {event.attendeeCount - externalAttendees.length} Arena
                      </span>
                    )}
                  </div>

                  {/* Notion Import inline */}
                  {isImporting && (
                    <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                      <LinkIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <input
                        type="text"
                        value={notionUrl}
                        onChange={(e) => setNotionUrl(e.target.value)}
                        placeholder="Paste Notion page URL..."
                        className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-indigo-300"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && submitNotionImport(event)}
                      />
                      <button
                        onClick={() => submitNotionImport(event)}
                        disabled={!notionUrl.trim()}
                        className="px-2.5 py-1 rounded-md bg-indigo-500 text-white text-[11px] font-medium hover:bg-indigo-600 transition-colors disabled:opacity-40"
                      >
                        Import
                      </button>
                      <button
                        onClick={() => setNotionEventId(null)}
                        className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    {onOpenCopilot && !isImporting && (
                      <button
                        onClick={() => importNotion(event)}
                        className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        <LinkIcon className="w-3 h-3" /> Import Notion
                      </button>
                    )}
                    <button
                      onClick={() => logFromCalendar(event)}
                      className="flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-600 transition-colors"
                    >
                      <PenLine className="w-3 h-3" /> Log Manually
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ─── Tab Content: Upcoming ─── */}
      {activeTab === "upcoming" && (
        <div className="flex flex-col gap-3">
          {calendarLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-4 animate-pulse">
                <div className="h-4 w-40 rounded bg-gray-100 mb-2" />
                <div className="h-3 w-56 rounded bg-gray-50" />
              </div>
            ))
          ) : upcoming.length === 0 ? (
            <Card>
              <EmptyState icon={<CalendarDays className="w-10 h-10 mb-3 text-gray-300" />} message="No upcoming external meetings in the next 2 weeks." />
            </Card>
          ) : (
            upcoming.map((event) => {
              const externalAttendees = event.attendees.filter((a) => a.isExternal);
              const knownAttendees = event.attendees.filter((a) => a.personId);
              const prep = event.prepContext;

              return (
                <Card key={event.id} borderLeft="#6366f1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{event.title}</span>
                      {event.suggestedDeploymentName && (
                        <Badge color="#6366f1" bg="#eef2ff">{event.suggestedDeploymentName}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <Clock className="w-3 h-3" />
                      {event.date} at {event.time}
                    </div>
                  </div>

                  {/* Attendees */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {externalAttendees.map((att, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                          att.personId
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}
                      >
                        {att.isChampion && <Star className="w-2.5 h-2.5 text-amber-400" />}
                        {att.name}
                        {att.personId && " \u2713"}
                      </span>
                    ))}
                    {event.attendeeCount - externalAttendees.length > 0 && (
                      <span className="text-[10px] text-gray-400">
                        + {event.attendeeCount - externalAttendees.length} Arena
                      </span>
                    )}
                  </div>

                  {/* Prep Context */}
                  {prep && (prep.openActionItems.length > 0 || prep.lastMeetingDate) && (
                    <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-2.5 mb-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <FileText className="w-3 h-3 text-indigo-500" />
                        <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">Prep Context</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] mb-1.5">
                        {prep.deploymentHealth && (
                          <div className="flex items-center gap-1">
                            <HealthDot health={prep.deploymentHealth} size={7} />
                            <span className="text-gray-600">{event.suggestedDeploymentName}</span>
                            {prep.deploymentStatus && <StatusBadge status={prep.deploymentStatus} />}
                          </div>
                        )}
                        {prep.lastMeetingDate && (
                          <span className="text-gray-500">
                            Last met: {prep.lastMeetingDate}
                            {prep.lastMeetingSentiment && (
                              <span className={`ml-1 ${
                                prep.lastMeetingSentiment === "positive" ? "text-green-600" :
                                prep.lastMeetingSentiment === "negative" ? "text-red-600" : "text-gray-500"
                              }`}>
                                ({prep.lastMeetingSentiment})
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {prep.openActionItems.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-amber-700">
                            {prep.openActionItems.length} open action item{prep.openActionItems.length !== 1 ? "s" : ""}:
                          </span>
                          {prep.openActionItems.map((item, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-600 ml-2">
                              <Circle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span>{item.title}</span>
                              {item.owner && <span className="text-gray-400">({item.owner})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location + metadata */}
                  <div className="flex items-center gap-2">
                    {knownAttendees.length > 0 && (
                      <span className="text-[10px] text-indigo-500">
                        {knownAttendees.length} known contact{knownAttendees.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {event.location && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <ExternalLink className="w-2.5 h-2.5" /> {event.location}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ─── Tab Content: Logged ─── */}
      {activeTab === "logged" && (
        <div className="flex flex-col gap-3">
          {recentlyLogged.length === 0 ? (
            <Card>
              <EmptyState icon={<FileText className="w-10 h-10 mb-3 text-gray-300" />} message="No meetings logged yet." />
            </Card>
          ) : (
            recentlyLogged.map((mtg) => {
              const doneCount = mtg.action_items?.filter((a) => a.done).length || 0;
              const totalCount = mtg.action_items?.length || 0;
              return (
                <Card
                  key={mtg.id}
                  hover
                  onClick={() => setSelectedMeeting(mtg)}
                  borderLeft="#16a34a"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{mtg.date}</span>
                      <Badge color="#6366f1" bg="#eef2ff">{mtg.type}</Badge>
                      <SentimentBadge sentiment={mtg.sentiment} />
                      {mtg.company && (
                        <Badge color="#6b7280" bg="#f3f4f6">
                          {mtg.company}{mtg.group_name ? ` / ${mtg.group_name}` : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {mtg.agenda_sent && (
                        <Badge color="#16a34a" bg="#f0fdf4">Agenda Sent</Badge>
                      )}
                      {mtg.recap_sent ? (
                        <Badge color="#16a34a" bg="#f0fdf4">Report Sent</Badge>
                      ) : (
                        <Badge color="#f59e0b" bg="#fffbeb">Report Pending</Badge>
                      )}
                    </div>
                  </div>

                  {/* Attendees */}
                  {mtg.attendees?.length > 0 && (
                    <p className="text-[11px] text-gray-500 mb-1">
                      <Users className="w-3 h-3 inline mr-1" />
                      {mtg.attendees.join(", ")}
                    </p>
                  )}

                  {/* Notes preview */}
                  {mtg.notes && (
                    <p className="text-[12px] text-gray-600 line-clamp-2 mb-2">{mtg.notes}</p>
                  )}

                  {/* Action items summary */}
                  {totalCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <CheckCircle2 className="w-3 h-3" />
                      {doneCount}/{totalCount} action items complete
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ─── Tab Content: Unmapped People ─── */}
      {activeTab === "unmapped" && (
        <div className="flex flex-col gap-4">
          {unmappedPeople.length === 0 ? (
            <Card>
              <EmptyState icon={<Users className="w-10 h-10 mb-3 text-gray-300" />} message="All external attendees are mapped to contacts." />
            </Card>
          ) : (
            <>
              <p className="text-[12px] text-gray-500">
                These external attendees appeared in your calendar meetings but don&apos;t match any DS contact.
                Add them as contacts to track relationships.
              </p>
              {unmappedByDomain.map(([domain, people]) => (
                <Card key={domain}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {domain}
                    </span>
                    <Badge color="#8b5cf6" bg="#f5f3ff">{people.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {people.map((person, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold">
                            {person.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{person.name}</span>
                            <span className="text-[11px] text-gray-400 ml-2">{person.email}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400">
                            {person.meetingCount} meeting{person.meetingCount !== 1 ? "s" : ""}
                          </span>
                          <button
                            onClick={() => addAsContact(person)}
                            className="flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                          >
                            <UserPlus className="w-3 h-3" /> Add as Contact
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* ─── Meeting Detail Modal ─── */}
      <Modal
        open={!!selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        title="Meeting Detail"
        wide
      >
        {selectedMeeting && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Badge color="#6366f1" bg="#eef2ff">{selectedMeeting.type}</Badge>
              <span className="text-sm text-gray-700">{selectedMeeting.date}</span>
              <SentimentBadge sentiment={selectedMeeting.sentiment} />
              {selectedMeeting.group_name && (
                <Badge color="#6b7280" bg="#f3f4f6">
                  {selectedMeeting.company} / {selectedMeeting.group_name}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              {selectedMeeting.agenda_sent ? (
                <Badge color="#16a34a" bg="#f0fdf4">Agenda Sent</Badge>
              ) : (
                <Badge color="#ef4444" bg="#fef2f2">No Agenda</Badge>
              )}
              {selectedMeeting.recap_sent ? (
                <Badge color="#16a34a" bg="#f0fdf4">Report Sent</Badge>
              ) : (
                <Badge color="#ef4444" bg="#fef2f2">Report Pending</Badge>
              )}
            </div>

            {selectedMeeting.attendees?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Attendees</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMeeting.attendees.map((name, i) => (
                    <Badge key={i} color="#374151" bg="#f3f4f6">{name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedMeeting.topics?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Topics</h4>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {selectedMeeting.topics.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedMeeting.notes && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMeeting.notes}</p>
              </div>
            )}

            {selectedMeeting.action_items?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Action Items</h4>
                <div className="flex flex-col gap-1.5">
                  {selectedMeeting.action_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                      <span className={item.done ? "text-gray-400 line-through" : "text-gray-800"}>
                        {item.title}
                      </span>
                      {item.owner && (
                        <span className="text-[11px] text-gray-400 ml-auto">{item.owner}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMeeting.expansion_signals && selectedMeeting.expansion_signals.length > 0 && (
              <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-semibold text-indigo-700 uppercase">Expansion Signals</span>
                </div>
                {selectedMeeting.expansion_signals.map((s, i) => (
                  <p key={i} className="text-sm text-indigo-800">{s}</p>
                ))}
              </div>
            )}

            {selectedMeeting.competitive_intel && selectedMeeting.competitive_intel.length > 0 && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-700 uppercase">Competitive Intel</span>
                </div>
                {selectedMeeting.competitive_intel.map((s, i) => (
                  <p key={i} className="text-sm text-orange-800">{s}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CRUD: Meeting Form */}
      {showForm && (
        <MeetingForm
          meeting={editMeeting || prefillMeeting as any}
          onClose={() => {
            setShowForm(false);
            setEditMeeting(null);
            setPrefillMeeting(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {/* CRUD: Person Form (for adding unmapped contacts) */}
      {showPersonForm && (
        <PersonForm
          person={prefillPerson ? { name: prefillPerson.name, email: prefillPerson.email } as any : null}
          onClose={() => {
            setShowPersonForm(false);
            setPrefillPerson(null);
          }}
          onSaved={() => {
            setShowPersonForm(false);
            setPrefillPerson(null);
            fetchCalendar(); // Refresh to update unmapped list
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
