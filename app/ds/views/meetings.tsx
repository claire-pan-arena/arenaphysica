"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Users,
  Zap,
  Shield,
  CheckCircle2,
  Circle,
  Plus,
  BarChart3,
} from "lucide-react";
import {
  Card,
  SectionHeader,
  SentimentBadge,
  Badge,
  Modal,
  EmptyState,
  type Meeting,
  type MeetingActionItem,
} from "../components/shared";
import { MeetingForm } from "./crud-modals";

interface Props {
  filterCompany: string;
  filterGroup: string;
  onRefresh: () => void;
}

interface IntelDossier {
  group_id: string;
  group_name: string;
  company: string;
  meeting_count: number;
  champion_count: number;
  open_actions: number;
  sentiment: string;
  expansion_signals: string[];
  competitive_intel: string[];
}

export default function MeetingsView({ filterCompany, filterGroup, onRefresh }: Props) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [dossiers, setDossiers] = useState<IntelDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"timeline" | "dossier">("timeline");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);

  const fetchMeetings = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompany) params.set("company", filterCompany);
    if (filterGroup) params.set("group", filterGroup);
    Promise.all([
      fetch(`/api/ds/meetings?${params}`).then((r) => r.json()),
      fetch(`/api/ds/meetings/dossier?${params}`).then((r) => r.json()),
    ])
      .then(([mtgs, doss]) => {
        setMeetings(mtgs.meetings || mtgs || []);
        setDossiers(doss.dossiers || doss || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMeetings();
  }, [filterCompany, filterGroup]);

  const handleSaved = () => {
    fetchMeetings();
    onRefresh();
    setShowForm(false);
    setEditMeeting(null);
  };

  // Sort meetings reverse chronologically
  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (loading) {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("timeline")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "timeline"
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Meeting Timeline
          </button>
          <button
            onClick={() => setTab("dossier")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "dossier"
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Customer Intel Dossier
          </button>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Log Meeting
        </button>
      </div>

      {/* ─── Meeting Timeline ─── */}
      {tab === "timeline" && (
        <>
          {sortedMeetings.length === 0 ? (
            <EmptyState message="No meetings logged yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {sortedMeetings.map((mtg) => {
                const doneCount = mtg.action_items?.filter((a) => a.done).length || 0;
                const totalCount = mtg.action_items?.length || 0;
                return (
                  <Card
                    key={mtg.id}
                    hover
                    onClick={() => setSelectedMeeting(mtg)}
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
                        {mtg.recap_sent && (
                          <Badge color="#16a34a" bg="#f0fdf4">Recap Sent</Badge>
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
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Customer Intel Dossier ─── */}
      {tab === "dossier" && (
        <>
          {dossiers.length === 0 ? (
            <EmptyState message="No customer intel data yet." />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {dossiers.map((dossier) => (
                <Card key={dossier.group_id}>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      {dossier.company} / {dossier.group_name}
                    </h3>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 mb-3 text-[11px]">
                    <span className="text-gray-500">
                      {dossier.meeting_count} meetings
                    </span>
                    <span className="text-gray-500">
                      {dossier.champion_count} champions
                    </span>
                    <span className="text-gray-500">
                      {dossier.open_actions} open actions
                    </span>
                  </div>

                  <SentimentBadge sentiment={dossier.sentiment} />

                  {/* Expansion signals */}
                  {dossier.expansion_signals?.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Zap className="w-3 h-3 text-indigo-500" />
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">
                          Expansion
                        </span>
                      </div>
                      {dossier.expansion_signals.map((s, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[12px] text-gray-600">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                          {s}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Competitive intel */}
                  {dossier.competitive_intel?.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 mb-1">
                        <Shield className="w-3 h-3 text-orange-500" />
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">
                          Competitive
                        </span>
                      </div>
                      {dossier.competitive_intel.map((s, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[12px] text-gray-600">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Meeting Detail Modal */}
      <Modal
        open={!!selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        title="Meeting Detail"
        wide
      >
        {selectedMeeting && (
          <div>
            {/* Header */}
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

            {/* Agenda/Recap badges */}
            <div className="flex items-center gap-2 mb-4">
              {selectedMeeting.agenda_sent ? (
                <Badge color="#16a34a" bg="#f0fdf4">Agenda Sent</Badge>
              ) : (
                <Badge color="#ef4444" bg="#fef2f2">No Agenda</Badge>
              )}
              {selectedMeeting.recap_sent ? (
                <Badge color="#16a34a" bg="#f0fdf4">Recap Sent</Badge>
              ) : (
                <Badge color="#ef4444" bg="#fef2f2">No Recap</Badge>
              )}
            </div>

            {/* Attendees */}
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

            {/* Topics */}
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

            {/* Notes */}
            {selectedMeeting.notes && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMeeting.notes}</p>
              </div>
            )}

            {/* Action Items */}
            {selectedMeeting.action_items?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Action Items
                </h4>
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

            {/* Expansion signals */}
            {selectedMeeting.expansion_signals && selectedMeeting.expansion_signals.length > 0 && (
              <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-semibold text-indigo-700 uppercase">
                    Expansion Signals
                  </span>
                </div>
                {selectedMeeting.expansion_signals.map((s, i) => (
                  <p key={i} className="text-sm text-indigo-800">{s}</p>
                ))}
              </div>
            )}

            {/* Competitive intel */}
            {selectedMeeting.competitive_intel && selectedMeeting.competitive_intel.length > 0 && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-700 uppercase">
                    Competitive Intel
                  </span>
                </div>
                {selectedMeeting.competitive_intel.map((s, i) => (
                  <p key={i} className="text-sm text-orange-800">{s}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CRUD */}
      {showForm && (
        <MeetingForm
          meeting={editMeeting}
          onClose={() => {
            setShowForm(false);
            setEditMeeting(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
