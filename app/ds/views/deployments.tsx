"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  ChevronLeft,
  Users,
  Star,
  CalendarDays,
  Plus,
} from "lucide-react";
import {
  Card,
  SectionHeader,
  PriorityBadge,
  StatusBadge,
  SentimentBadge,
  HealthDot,
  ProgressBar,
  Badge,
  EmptyState,
  type Deployment,
  type Group,
  type Workstream,
  type Person,
  type Meeting,
} from "../components/shared";
import {
  DeploymentForm,
  GroupForm,
  PersonForm,
  WorkstreamForm,
  MeetingForm,
} from "./crud-modals";

interface Props {
  filterCompany: string;
  onRefresh: () => void;
}

export default function DeploymentsView({ filterCompany, onRefresh }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  // Drill-down state: deployment level
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  // Drill-down state: group level
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupWorkstreams, setGroupWorkstreams] = useState<Workstream[]>([]);
  const [groupPeople, setGroupPeople] = useState<Person[]>([]);
  const [groupMeetings, setGroupMeetings] = useState<Meeting[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(false);

  // Deployment detail data (must be at top level — React hooks rule)
  const [depPeople, setDepPeople] = useState<Person[]>([]);
  const [depMeetings, setDepMeetings] = useState<Meeting[]>([]);
  const [depWorkstreams, setDepWorkstreams] = useState<Workstream[]>([]);
  const [depLoading, setDepLoading] = useState(false);
  const [showDepPersonForm, setShowDepPersonForm] = useState(false);

  // CRUD
  const [showDeploymentForm, setShowDeploymentForm] = useState(false);
  const [editDeployment, setEditDeployment] = useState<Deployment | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showWorkstreamForm, setShowWorkstreamForm] = useState(false);

  const fetchDeployments = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompany) params.set("company", filterCompany);
    fetch(`/api/ds/deployments?${params}`)
      .then((r) => r.json())
      .then((d) => setDeployments(d.deployments || d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDeployments();
  }, [filterCompany]);

  // Fetch deployment detail data when a deployment is selected
  useEffect(() => {
    if (!selectedDeployment) return;
    setDepLoading(true);
    Promise.all([
      fetch(`/api/ds/people?deployment_id=${selectedDeployment.id}`).then((r) => r.json()),
      fetch(`/api/ds/meetings?deployment_id=${selectedDeployment.id}&limit=5`).then((r) => r.json()),
      fetch(`/api/ds/workstreams?deployment_id=${selectedDeployment.id}`).then((r) => r.json()).catch(() => ({ workstreams: [] })),
    ]).then(([pData, mData, wData]) => {
      setDepPeople(pData.people || []);
      setDepMeetings(mData.meetings || []);
      setDepWorkstreams(wData.workstreams || wData || []);
    }).catch(() => {}).finally(() => setDepLoading(false));
  }, [selectedDeployment?.id]);

  const drillIntoGroup = (group: Group) => {
    setSelectedGroup(group);
    setLoadingGroup(true);
    Promise.all([
      fetch(`/api/ds/workstreams?group_id=${group.id}`).then((r) => r.json()),
      fetch(`/api/ds/people?group_id=${group.id}`).then((r) => r.json()),
      fetch(`/api/ds/meetings?group_id=${group.id}`).then((r) => r.json()),
    ])
      .then(([ws, ppl, mtgs]) => {
        setGroupWorkstreams(ws.workstreams || ws || []);
        setGroupPeople(ppl.people || ppl || []);
        setGroupMeetings((mtgs.meetings || mtgs || []).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoadingGroup(false));
  };

  const handleSaved = () => {
    fetchDeployments();
    onRefresh();
    setShowDeploymentForm(false);
    setEditDeployment(null);
    setShowGroupForm(false);
    setShowWorkstreamForm(false);
    if (selectedGroup) drillIntoGroup(selectedGroup);
  };

  // ─── Level 1.5: Deployment detail (North Star aligned) ───
  if (selectedDeployment && !selectedGroup) {
    const dep = selectedDeployment;
    const depGroups = dep.groups || [];

    // Aggregate expansion signals and competitive intel from meetings
    const allSignals: string[] = [];
    const allIntel: string[] = [];
    for (const m of depMeetings) {
      if (m.expansion_signals) {
        for (const s of (Array.isArray(m.expansion_signals) ? m.expansion_signals : [])) {
          if (s && !allSignals.includes(s)) allSignals.push(s);
        }
      }
      if (m.competitive_intel) {
        for (const c of (Array.isArray(m.competitive_intel) ? m.competitive_intel : [])) {
          if (c && !allIntel.includes(c)) allIntel.push(c);
        }
      }
    }

    return (
      <div>
        {/* Back button */}
        <button
          onClick={() => setSelectedDeployment(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Deployments
        </button>

        {/* Deployment header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <HealthDot health={dep.health} size={14} />
              <h2 className="text-lg font-semibold text-gray-900">{dep.name || dep.company}</h2>
              <StatusBadge status={dep.status} />
            </div>
            {dep.name && <p className="text-sm text-gray-500 ml-7 mt-0.5">{dep.company}</p>}
            {dep.start_date && <p className="text-[11px] text-gray-400 ml-7 mt-0.5">Started {dep.start_date}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditDeployment(dep); setShowDeploymentForm(true); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDepPersonForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Person
            </button>
          </div>
        </div>

        {depLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-4 animate-pulse">
                <div className="h-4 w-32 rounded bg-gray-100 mb-3" />
                <div className="h-3 w-48 rounded bg-gray-50" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 2-column layout */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Left: Key Contacts */}
              <Card>
                <SectionHeader
                  icon={<Users className="w-4 h-4" />}
                  title="Key Contacts"
                  count={depPeople.length}
                />
                {depPeople.length === 0 ? (
                  <p className="text-sm text-gray-400">No contacts yet.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {depPeople.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${
                          p.is_champion ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gray-400"
                        }`}>
                          {p.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900 truncate font-medium">{p.name}</span>
                            {p.is_champion && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-gray-500">{p.role}</span>
                        </div>
                        <SentimentBadge sentiment={p.sentiment} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Right: Recent Meetings */}
              <Card>
                <SectionHeader
                  icon={<CalendarDays className="w-4 h-4" />}
                  title="Recent Meetings"
                  count={depMeetings.length}
                />
                {depMeetings.length === 0 ? (
                  <p className="text-sm text-gray-400">No meetings logged yet.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {depMeetings.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-medium text-gray-800">{m.date}</span>
                            <Badge color="#6366f1" bg="#eef2ff">{m.type}</Badge>
                          </div>
                          {m.attendees?.length > 0 && (
                            <span className="text-[10px] text-gray-400">{m.attendees.length} attendee{m.attendees.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                        <SentimentBadge sentiment={m.sentiment} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Active Workstreams (full width table) */}
            {depWorkstreams.length > 0 && (
              <Card className="mb-4">
                <SectionHeader
                  icon={<Building2 className="w-4 h-4" />}
                  title="Active Workstreams"
                  count={depWorkstreams.length}
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Owner</th>
                        <th className="pb-2 font-medium">Priority</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depWorkstreams.map((ws: any) => (
                        <tr key={ws.id} className="border-b border-gray-50">
                          <td className="py-1.5 text-gray-900 font-medium">{ws.name}</td>
                          <td className="py-1.5 text-gray-600">{ws.owner || "—"}</td>
                          <td className="py-1.5"><PriorityBadge priority={ws.priority} /></td>
                          <td className="py-1.5"><StatusBadge status={ws.status} /></td>
                          <td className="py-1.5 text-gray-500">{ws.due_date || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Intel & Signals (full width, side by side) */}
            {(allSignals.length > 0 || allIntel.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {allSignals.length > 0 && (
                  <Card>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Expansion Signals</h4>
                    <div className="flex flex-col gap-1">
                      {allSignals.map((s, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[12px]">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                          <span className="text-gray-700">{s}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {allIntel.length > 0 && (
                  <Card>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Competitive Intel</h4>
                    <div className="flex flex-col gap-1">
                      {allIntel.map((c, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[12px]">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                          <span className="text-gray-700">{c}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Groups (organizational tool, at bottom) */}
            {depGroups.length > 0 && (
              <div className="mb-4">
                <SectionHeader
                  icon={<Building2 className="w-4 h-4" />}
                  title="Groups"
                  count={depGroups.length}
                  action={
                    <button
                      onClick={() => setShowGroupForm(true)}
                      className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium"
                    >
                      + Add Group
                    </button>
                  }
                />
                <div className="grid grid-cols-3 gap-3">
                  {depGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => drillIntoGroup({ ...group, company: dep.company })}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 cursor-pointer hover:bg-gray-100 transition-all"
                    >
                      <div className="flex items-center gap-1.5">
                        <HealthDot health={group.health} size={7} />
                        <span className="text-[12px] font-medium text-gray-900">{group.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                        <span>{group.people_count || 0} people</span>
                        <span>{group.workstream_count || 0} ws</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {depGroups.length === 0 && (
              <button
                onClick={() => setShowGroupForm(true)}
                className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium mb-4"
              >
                + Add Group (for org chart organization)
              </button>
            )}

            {/* Notes */}
            {dep.notes && (
              <Card>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{dep.notes}</p>
              </Card>
            )}
          </>
        )}

        {/* CRUD modals */}
        {showDeploymentForm && (
          <DeploymentForm
            deployment={editDeployment}
            onClose={() => { setShowDeploymentForm(false); setEditDeployment(null); }}
            onSaved={() => {
              handleSaved();
              fetchDeployments();
              setSelectedDeployment(null);
            }}
          />
        )}
        {showGroupForm && (
          <GroupForm
            deploymentId={dep.id}
            onClose={() => setShowGroupForm(false)}
            onSaved={handleSaved}
          />
        )}
        {showDepPersonForm && (
          <PersonForm
            deploymentId={dep.id}
            onClose={() => setShowDepPersonForm(false)}
            onSaved={() => {
              setShowDepPersonForm(false);
              handleSaved();
              // Refresh deployment data
              fetch(`/api/ds/people?deployment_id=${dep.id}`).then((r) => r.json()).then((d) => setDepPeople(d.people || []));
            }}
          />
        )}
      </div>
    );
  }

  // ─── Level 2: Group detail ───
  if (selectedGroup) {
    // Build a simple org tree
    const peopleById = Object.fromEntries(groupPeople.map((p) => [p.id, p]));
    const roots = groupPeople.filter((p) => !p.reports_to || !peopleById[p.reports_to]);
    const children = (parentId: string) =>
      groupPeople.filter((p) => p.reports_to === parentId);

    function renderOrgNode(person: Person, depth: number) {
      return (
        <div key={person.id} style={{ marginLeft: depth * 24 }} className="flex flex-col">
          <div className="flex items-center gap-2 py-1.5">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-semibold shrink-0 ${
                person.is_champion
                  ? "bg-gradient-to-br from-amber-400 to-orange-500"
                  : "bg-gray-400"
              }`}
            >
              {person.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-900">{person.name}</span>
                {person.is_champion && <Star className="w-3 h-3 text-amber-400" />}
              </div>
              <span className="text-[11px] text-gray-500">{person.role}</span>
            </div>
            <SentimentBadge sentiment={person.sentiment} />
          </div>
          {children(person.id).map((child) => renderOrgNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <div>
        {/* Back button */}
        <button
          onClick={() => setSelectedGroup(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {selectedDeployment ? `Back to ${selectedDeployment.name || selectedDeployment.company}` : "Back to Deployments"}
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <HealthDot health={selectedGroup.health} size={14} />
          <h2 className="text-lg font-semibold text-gray-900">{selectedGroup.name}</h2>
          <Badge color="#6b7280" bg="#f3f4f6">
            {selectedGroup.company || ""}
          </Badge>
        </div>

        {loadingGroup ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-4 animate-pulse">
                <div className="h-4 w-32 rounded bg-gray-100 mb-3" />
                <div className="h-3 w-48 rounded bg-gray-50" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Workstreams */}
            <SectionHeader
              icon={<Building2 className="w-4 h-4" />}
              title="Workstreams"
              count={groupWorkstreams.length}
              action={
                <button
                  onClick={() => setShowWorkstreamForm(true)}
                  className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-3 mb-6">
              {groupWorkstreams.map((ws) => (
                <Card key={ws.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={ws.priority} />
                      <StatusBadge status={ws.status} />
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">{ws.name}</h4>
                  <ProgressBar
                    done={ws.tasks_done || 0}
                    total={ws.tasks_total || 0}
                    label="Tasks"
                  />
                  <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
                    <span>Owner: {ws.owner}</span>
                    {ws.due_date && <span>Due: {ws.due_date}</span>}
                  </div>
                </Card>
              ))}
            </div>

            {/* Org Chart */}
            <SectionHeader
              icon={<Users className="w-4 h-4" />}
              title="Org Chart"
              count={groupPeople.length}
            />
            <Card className="mb-6">
              {groupPeople.length > 0 ? (
                <div className="flex flex-col">
                  {roots.map((person) => renderOrgNode(person, 0))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No people added yet.</p>
              )}
            </Card>

            {/* Recent Meetings */}
            <SectionHeader
              icon={<CalendarDays className="w-4 h-4" />}
              title="Recent Meetings"
              count={groupMeetings.length}
            />
            <div className="flex flex-col gap-2">
              {groupMeetings.map((mtg) => (
                <Card key={mtg.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{mtg.date}</span>
                      <Badge color="#6366f1" bg="#eef2ff">{mtg.type}</Badge>
                      <SentimentBadge sentiment={mtg.sentiment} />
                    </div>
                    <div className="flex items-center gap-2">
                      {mtg.agenda_sent && <Badge color="#16a34a" bg="#f0fdf4">Agenda</Badge>}
                      {mtg.recap_sent && <Badge color="#16a34a" bg="#f0fdf4">Recap</Badge>}
                    </div>
                  </div>
                  {mtg.notes && (
                    <p className="text-[12px] text-gray-600 mt-2 line-clamp-2">{mtg.notes}</p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        {/* CRUD modals */}
        {showWorkstreamForm && (
          <WorkstreamForm
            groupId={selectedGroup.id}
            onClose={() => setShowWorkstreamForm(false)}
            onSaved={handleSaved}
          />
        )}
      </div>
    );
  }

  // ─── Level 1: Deployment list ───
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
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
        <h2 className="text-sm font-semibold text-gray-700">
          {deployments.length} Deployment{deployments.length !== 1 ? "s" : ""}
        </h2>
        <button
          onClick={() => setShowDeploymentForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Deployment
        </button>
      </div>

      {deployments.length === 0 ? (
        <EmptyState message="No deployments yet. Create one to get started." />
      ) : (
        <div className="flex flex-col gap-4">
          {deployments.map((dep) => (
            <Card
              key={dep.id}
              hover
              onClick={() => setSelectedDeployment(dep)}
            >
              <div className="flex items-center gap-3">
                <HealthDot health={dep.health} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {dep.name || dep.company}
                    </h3>
                    <StatusBadge status={dep.status} />
                  </div>
                  {dep.name && (
                    <p className="text-[12px] text-gray-500">{dep.company}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-gray-400 shrink-0">
                  {dep.groups && dep.groups.length > 0 && (
                    <span>{dep.groups.length} group{dep.groups.length !== 1 ? "s" : ""}</span>
                  )}
                  {dep.start_date && <span>Started {dep.start_date}</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CRUD modals */}
      {showDeploymentForm && (
        <DeploymentForm
          deployment={editDeployment}
          onClose={() => {
            setShowDeploymentForm(false);
            setEditDeployment(null);
          }}
          onSaved={handleSaved}
        />
      )}
      {showGroupForm && (
        <GroupForm
          onClose={() => setShowGroupForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
