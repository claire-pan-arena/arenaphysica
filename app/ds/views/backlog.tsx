"use client";

import { useEffect, useState } from "react";
import {
  ListChecks,
  CalendarDays,
  Briefcase,
  CheckCircle2,
  Circle,
  Plus,
} from "lucide-react";
import {
  Card,
  SectionHeader,
  PriorityBadge,
  StatusBadge,
  ProgressBar,
  Badge,
  EmptyState,
  type Workstream,
  type Task,
  type WeeklySnapshot,
} from "../components/shared";
import { WorkstreamForm, TaskForm, SnapshotForm } from "./crud-modals";

interface Props {
  filterCompany: string;
  filterGroup: string;
  onRefresh: () => void;
}

export default function BacklogView({ filterCompany, filterGroup, onRefresh }: Props) {
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [snapshots, setSnapshots] = useState<WeeklySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"backlog" | "sprint" | "internal">("backlog");

  // CRUD
  const [showWorkstreamForm, setShowWorkstreamForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState<string | null>(null); // workstream id
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompany) params.set("company", filterCompany);
    if (filterGroup) params.set("group", filterGroup);
    Promise.all([
      fetch(`/api/ds/workstreams?${params}`).then((r) => r.json()),
      fetch(`/api/ds/snapshots?${params}`).then((r) => r.json()),
    ])
      .then(([ws, sn]) => {
        setWorkstreams(ws.workstreams || ws || []);
        setSnapshots(sn.snapshots || sn || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filterCompany, filterGroup]);

  const handleSaved = () => {
    fetchData();
    onRefresh();
    setShowWorkstreamForm(false);
    setShowTaskForm(null);
    setShowSnapshotForm(false);
  };

  // Group workstreams by priority
  const byPriority: Record<string, Workstream[]> = { P0: [], P1: [], P2: [] };
  workstreams.forEach((ws) => {
    if (!ws.is_internal) {
      const key = ws.priority || "P2";
      if (!byPriority[key]) byPriority[key] = [];
      byPriority[key].push(ws);
    }
  });

  const internalWorkstreams = workstreams.filter((ws) => ws.is_internal);

  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(b.week_of).getTime() - new Date(a.week_of).getTime()
  );

  const priorityConfig: Record<string, { label: string; headerBg: string; headerText: string }> = {
    P0: { label: "P0 - Critical", headerBg: "bg-red-50 border-red-200", headerText: "text-red-700" },
    P1: { label: "P1 - High", headerBg: "bg-amber-50 border-amber-200", headerText: "text-amber-700" },
    P2: { label: "P2 - Normal", headerBg: "bg-blue-50 border-blue-200", headerText: "text-blue-700" },
  };

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

  function renderWorkstreamCard(ws: Workstream) {
    return (
      <Card key={ws.id}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={ws.priority} />
            <StatusBadge status={ws.status} />
          </div>
          {ws.group_name && <Badge color="#6b7280" bg="#f3f4f6">{ws.group_name}</Badge>}
        </div>
        <h4 className="text-sm font-medium text-gray-900 mb-1">{ws.name}</h4>
        {ws.due_date && (
          <p className="text-[11px] text-gray-500 mb-2">Due: {ws.due_date}</p>
        )}
        <ProgressBar done={ws.tasks_done || 0} total={ws.tasks_total || 0} label="Tasks" />

        {/* Tasks checklist */}
        {ws.tasks && ws.tasks.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-2 flex flex-col gap-1">
            {ws.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-[12px]">
                {task.status === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                )}
                <span
                  className={
                    task.status === "done" ? "text-gray-400 line-through" : "text-gray-700"
                  }
                >
                  {task.title}
                </span>
                {task.owner && (
                  <span className="text-gray-400 ml-auto">{task.owner}</span>
                )}
              </div>
            ))}
            <button
              onClick={() => setShowTaskForm(ws.id)}
              className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 mt-1"
            >
              <Plus className="w-3 h-3" /> Add Task
            </button>
          </div>
        )}
        {(!ws.tasks || ws.tasks.length === 0) && (
          <button
            onClick={() => setShowTaskForm(ws.id)}
            className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 mt-2"
          >
            <Plus className="w-3 h-3" /> Add Task
          </button>
        )}
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("backlog")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "backlog"
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Full Backlog
          </button>
          <button
            onClick={() => setTab("sprint")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "sprint"
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Weekly Sprint
          </button>
          <button
            onClick={() => setTab("internal")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "internal"
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Internal Work
          </button>
        </div>
        <div className="flex items-center gap-2">
          {tab === "sprint" && (
            <button
              onClick={() => setShowSnapshotForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Snapshot
            </button>
          )}
          {(tab === "backlog" || tab === "internal") && (
            <button
              onClick={() => setShowWorkstreamForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Workstream
            </button>
          )}
        </div>
      </div>

      {/* ─── Full Backlog ─── */}
      {tab === "backlog" && (
        <div className="flex flex-col gap-6">
          {(["P0", "P1", "P2"] as const).map((priority) => {
            const items = byPriority[priority] || [];
            const config = priorityConfig[priority];
            return (
              <div key={priority}>
                <div
                  className={`rounded-lg border px-4 py-2 mb-3 ${config.headerBg}`}
                >
                  <h3 className={`text-sm font-semibold ${config.headerText}`}>
                    {config.label}
                    <span className="ml-2 text-[11px] font-normal opacity-70">
                      ({items.length})
                    </span>
                  </h3>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 ml-4">No {priority} workstreams.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {items.map(renderWorkstreamCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Weekly Sprint ─── */}
      {tab === "sprint" && (
        <>
          {sortedSnapshots.length === 0 ? (
            <EmptyState message="No weekly snapshots yet. Create one to track your sprint." />
          ) : (
            <div className="flex flex-col gap-4">
              {sortedSnapshots.map((snap) => (
                <Card key={snap.id}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    <CalendarDays className="w-4 h-4 inline mr-1.5 text-gray-400" />
                    Week of {snap.week_of}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {snap.items?.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={item.priority} />
                          <span className="text-sm text-gray-800">
                            {item.workstream_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.status} />
                          {item.notes && (
                            <span className="text-[11px] text-gray-400 max-w-[200px] truncate">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {snap.reflections && (
                    <div className="mt-3 rounded-lg bg-purple-50 border border-purple-200 p-3">
                      <h4 className="text-[11px] font-semibold text-purple-700 uppercase mb-1">
                        Reflections
                      </h4>
                      <p className="text-sm text-purple-800">{snap.reflections}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Internal Work ─── */}
      {tab === "internal" && (
        <>
          {internalWorkstreams.length === 0 ? (
            <EmptyState message="No internal workstreams yet." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {internalWorkstreams.map((ws) => (
                <Card key={ws.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={ws.priority} />
                      <StatusBadge status={ws.status} />
                    </div>
                    {ws.linked_deployment && (
                      <Badge color="#6366f1" bg="#eef2ff">{ws.linked_deployment}</Badge>
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">{ws.name}</h4>
                  {ws.due_date && (
                    <p className="text-[11px] text-gray-500 mb-2">Due: {ws.due_date}</p>
                  )}
                  <ProgressBar
                    done={ws.tasks_done || 0}
                    total={ws.tasks_total || 0}
                    label="Tasks"
                  />
                  {ws.tasks && ws.tasks.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-2 flex flex-col gap-1">
                      {ws.tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-2 text-[12px]">
                          {task.status === "done" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                          )}
                          <span
                            className={
                              task.status === "done"
                                ? "text-gray-400 line-through"
                                : "text-gray-700"
                            }
                          >
                            {task.title}
                          </span>
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

      {/* CRUD Modals */}
      {showWorkstreamForm && (
        <WorkstreamForm
          isInternal={tab === "internal"}
          onClose={() => setShowWorkstreamForm(false)}
          onSaved={handleSaved}
        />
      )}
      {showTaskForm && (
        <TaskForm
          workstreamId={showTaskForm}
          onClose={() => setShowTaskForm(null)}
          onSaved={handleSaved}
        />
      )}
      {showSnapshotForm && (
        <SnapshotForm
          workstreams={workstreams}
          onClose={() => setShowSnapshotForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
