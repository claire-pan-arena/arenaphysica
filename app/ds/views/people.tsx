"use client";

import { useEffect, useState } from "react";
import {
  Star,
  Coffee,
  Mail,
  Clock,
  Plus,
  GitBranch,
  LayoutGrid,
  Link2,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  Card,
  SentimentBadge,
  Badge,
  Modal,
  EmptyState,
  type Person,
  type Meeting,
} from "../components/shared";
import { PersonForm } from "./crud-modals";

const OrgChart = dynamic(() => import("./org-chart"), { ssr: false });

interface Props {
  filterCompany: string;
  filterGroup: string;
  onRefresh: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

function FreshnessIndicator({ days }: { days: number | null }) {
  if (days === null) return <span className="text-[11px] text-gray-300">No contact</span>;
  if (days <= 3)
    return <Badge color="#16a34a" bg="#f0fdf4">{days}d ago</Badge>;
  if (days <= 7)
    return <Badge color="#d97706" bg="#fffbeb">{days}d ago</Badge>;
  return <Badge color="#ef4444" bg="#fef2f2">{days}d ago</Badge>;
}

export default function PeopleView({ filterCompany, filterGroup, onRefresh }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [personMeetings, setPersonMeetings] = useState<Meeting[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "orgchart">("grid");
  const [linkMode, setLinkMode] = useState(false);

  const fetchPeople = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompany) params.set("company", filterCompany);
    if (filterGroup) params.set("group", filterGroup);
    fetch(`/api/ds/people?${params}`)
      .then((r) => r.json())
      .then((d) => setPeople(d.people || d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPeople();
  }, [filterCompany, filterGroup]);

  const openPersonDetail = (person: Person) => {
    setSelectedPerson(person);
    fetch(`/api/ds/meetings?person_id=${person.id}`)
      .then((r) => r.json())
      .then((d) => setPersonMeetings(d.meetings || d || []))
      .catch(() => setPersonMeetings([]));
  };

  const handleSaved = () => {
    fetchPeople();
    onRefresh();
    setShowForm(false);
    setEditPerson(null);
  };

  const handleLinkPersons = async (personId: string, managerId: string) => {
    await fetch("/api/ds/people", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: personId, reports_to: managerId }),
    });
    fetchPeople();
    onRefresh();
    setLinkMode(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-100" />
              <div>
                <div className="h-4 w-24 rounded bg-gray-100 mb-1" />
                <div className="h-3 w-16 rounded bg-gray-50" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {people.length} Contact{people.length !== 1 ? "s" : ""}
          </h2>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setViewMode("grid"); setLinkMode(false); }}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors ${
                viewMode === "grid" ? "bg-gray-100 text-gray-800 font-medium" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Cards
            </button>
            <button
              onClick={() => setViewMode("orgchart")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors ${
                viewMode === "orgchart" ? "bg-gray-100 text-gray-800 font-medium" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <GitBranch className="w-3 h-3" /> Org Chart
            </button>
          </div>
          {viewMode === "orgchart" && (
            <button
              onClick={() => setLinkMode(!linkMode)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                linkMode
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                  : "border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Link2 className="w-3 h-3" /> {linkMode ? "Linking..." : "Set Reports To"}
            </button>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Person
        </button>
      </div>

      {people.length === 0 ? (
        <EmptyState message="No contacts yet. Add people to your deployments." />
      ) : viewMode === "orgchart" ? (
        <OrgChart
          people={people}
          onPersonClick={openPersonDetail}
          onLinkPersons={handleLinkPersons}
          linkMode={linkMode}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {people.map((person) => {
            const days = daysSince(person.last_contact);
            return (
              <Card
                key={person.id}
                hover
                onClick={() => openPersonDetail(person)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full text-white text-[12px] font-semibold shrink-0 ${
                      person.is_champion
                        ? "bg-gradient-to-br from-amber-400 to-orange-500"
                        : "bg-gray-400"
                    }`}
                  >
                    {getInitials(person.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {person.name}
                      </span>
                      {person.is_champion && (
                        <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{person.role}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <SentimentBadge sentiment={person.sentiment} />
                  {person.group_name && (
                    <Badge color="#6b7280" bg="#f3f4f6">{person.group_name}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    Last contact
                  </div>
                  <FreshnessIndicator days={days} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Person Detail Modal */}
      <Modal
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        title="Person Detail"
        wide
      >
        {selectedPerson && (
          <div>
            <div className="flex items-start gap-4 mb-6">
              <div
                className={`flex items-center justify-center w-16 h-16 rounded-full text-white text-xl font-semibold shrink-0 ${
                  selectedPerson.is_champion
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : "bg-gray-400"
                }`}
              >
                {getInitials(selectedPerson.name)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedPerson.name}
                  </h3>
                  {selectedPerson.is_champion && (
                    <Star className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <p className="text-sm text-gray-500">{selectedPerson.role}</p>
                <div className="flex items-center gap-2 mt-2">
                  <SentimentBadge sentiment={selectedPerson.sentiment} />
                  {selectedPerson.group_name && (
                    <Badge color="#6b7280" bg="#f3f4f6">{selectedPerson.group_name}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{selectedPerson.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  Last contact: {selectedPerson.last_contact || "Never"}
                </span>
              </div>
            </div>

            {/* Fun fact */}
            {selectedPerson.fun_fact && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coffee className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 uppercase">Fun Fact</span>
                </div>
                <p className="text-sm text-amber-800">{selectedPerson.fun_fact}</p>
              </div>
            )}

            {/* Notes */}
            {selectedPerson.notes && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</h4>
                <p className="text-sm text-gray-700">{selectedPerson.notes}</p>
              </div>
            )}

            {/* Meeting history */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Meeting History
              </h4>
              {personMeetings.length === 0 ? (
                <p className="text-sm text-gray-400">No meetings recorded.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {personMeetings.map((mtg) => (
                    <div
                      key={mtg.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-800">{mtg.date}</span>
                        <Badge color="#6366f1" bg="#eef2ff">{mtg.type}</Badge>
                      </div>
                      <SentimentBadge sentiment={mtg.sentiment} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* CRUD */}
      {showForm && (
        <PersonForm
          person={editPerson}
          onClose={() => {
            setShowForm(false);
            setEditPerson(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
