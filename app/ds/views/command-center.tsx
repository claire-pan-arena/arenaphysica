"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Building2,
  Users,
  Zap,
  Shield,
  Star,
  CalendarDays,
  Plus,
} from "lucide-react";
import {
  Card,
  SectionHeader,
  PriorityBadge,
  StatusBadge,
  HealthDot,
  ProgressBar,
  Badge,
  EmptyState,
  type CommandData,
} from "../components/shared";

interface Props {
  filterCompany: string;
  filterGroup: string;
  onNavigate: (view: "command" | "deployments" | "people" | "meetings" | "backlog") => void;
  onRefresh: () => void;
}

export default function CommandCenter({ filterCompany, filterGroup, onNavigate }: Props) {
  const [data, setData] = useState<CommandData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCompany) params.set("company", filterCompany);
    if (filterGroup) params.set("group", filterGroup);
    fetch(`/api/ds/command?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterCompany, filterGroup]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`bg-white rounded-[10px] border border-gray-200 p-4 animate-pulse ${
              i === 0 || i === 5 ? "col-span-2" : ""
            }`}
          >
            <div className="h-4 w-32 rounded bg-gray-100 mb-3" />
            <div className="h-3 w-48 rounded bg-gray-50 mb-2" />
            <div className="h-3 w-40 rounded bg-gray-50" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return <EmptyState message="Unable to load command center data." />;
  }

  const overdue = data.needs_attention?.overdue || [];
  const dueSoon = data.needs_attention?.due_soon || [];
  const hasAttention = overdue.length > 0 || dueSoon.length > 0;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* ─── Needs Attention (full width) ─── */}
      <Card className="col-span-2" borderLeft="#ef4444">
        <SectionHeader
          icon={<AlertTriangle className="w-4 h-4" />}
          title="Needs Attention"
          count={overdue.length + dueSoon.length}
        />
        {hasAttention ? (
          <div className="flex flex-col gap-2">
            {overdue.map((item: any, i: number) => (
              <div
                key={`overdue-${i}`}
                className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-sm text-gray-900">{item.title || item.name}</span>
                  {item.priority && <PriorityBadge priority={item.priority} />}
                </div>
                <span className="text-[11px] text-red-500 font-medium">
                  Overdue {item.due_date}
                </span>
              </div>
            ))}
            {dueSoon.map((item: any, i: number) => (
              <div
                key={`due-${i}`}
                className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-sm text-gray-900">{item.title || item.name}</span>
                  {item.priority && <PriorityBadge priority={item.priority} />}
                </div>
                <span className="text-[11px] text-amber-600 font-medium">
                  Due {item.due_date}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nothing urgent right now.</p>
        )}
      </Card>

      {/* ─── This Week ─── */}
      <Card>
        <SectionHeader
          icon={<CalendarDays className="w-4 h-4" />}
          title="This Week"
          count={data.this_week?.length || 0}
        />
        {data.this_week?.length ? (
          <div className="flex flex-col gap-2">
            {data.this_week.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={item.priority} />
                  <span className="text-gray-800 truncate">{item.workstream_name}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No weekly snapshot yet.</p>
        )}
      </Card>

      {/* ─── Deployment Health ─── */}
      <Card>
        <SectionHeader
          icon={<Building2 className="w-4 h-4" />}
          title="Deployment Health"
          count={data.deployment_health?.length || 0}
          action={
            <button
              onClick={() => onNavigate("deployments")}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium"
            >
              View All
            </button>
          }
        />
        {data.deployment_health?.length ? (
          <div className="flex flex-col gap-3">
            {data.deployment_health.map((dep) => (
              <div key={dep.id}>
                <div className="flex items-center gap-2 mb-1">
                  <HealthDot health={dep.health} />
                  <span className="text-sm font-medium text-gray-900">{dep.name || dep.company}</span>
                  {dep.name && <span className="text-[11px] text-gray-400 ml-1">{dep.company}</span>}
                </div>
                <div className="flex flex-wrap gap-2 ml-5">
                  {dep.groups?.map((g, gi) => (
                    <div key={gi} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <HealthDot health={g.health} size={7} />
                      <span>{g.name}</span>
                      <span className="text-gray-400">{g.completion_pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No deployments yet.</p>
        )}
      </Card>

      {/* ─── Upcoming Deadlines ─── */}
      <Card>
        <SectionHeader
          icon={<Clock className="w-4 h-4" />}
          title="Upcoming Deadlines"
          count={data.upcoming_deadlines?.length || 0}
        />
        {data.upcoming_deadlines?.length ? (
          <div className="flex flex-col gap-2">
            {data.upcoming_deadlines.slice(0, 8).map((item: any, i: number) => {
              const daysUntil = Math.ceil(
                (new Date(item.due_date).getTime() - Date.now()) / 86400000
              );
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={item.priority || "P2"} />
                    <span className="text-gray-800 truncate">{item.title || item.name}</span>
                  </div>
                  <Badge
                    color={daysUntil <= 1 ? "#ef4444" : daysUntil <= 3 ? "#f59e0b" : "#6b7280"}
                    bg={daysUntil <= 1 ? "#fef2f2" : daysUntil <= 3 ? "#fffbeb" : "#f3f4f6"}
                  >
                    {daysUntil <= 0 ? "Today" : `${daysUntil}d`}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No upcoming deadlines.</p>
        )}
      </Card>

      {/* ─── Relationship Alerts ─── */}
      <Card>
        <SectionHeader
          icon={<Users className="w-4 h-4" />}
          title="Relationship Alerts"
          count={data.relationship_alerts?.length || 0}
          action={
            <button
              onClick={() => onNavigate("people")}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium"
            >
              View All
            </button>
          }
        />
        {data.relationship_alerts?.length ? (
          <div className="flex flex-col gap-2">
            {data.relationship_alerts.map((person: any, i: number) => {
              const daysSince = person.days_since_contact || 0;
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {person.is_champion && <Star className="w-3.5 h-3.5 text-amber-400" />}
                    <span className="text-gray-800">{person.name}</span>
                    <span className="text-[11px] text-gray-400">{person.role}</span>
                  </div>
                  <Badge
                    color={daysSince > 14 ? "#ef4444" : "#f59e0b"}
                    bg={daysSince > 14 ? "#fef2f2" : "#fffbeb"}
                  >
                    {daysSince}d ago
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">All contacts are fresh.</p>
        )}
      </Card>

      {/* ─── Expansion & Competitive Intel (full width) ─── */}
      <Card className="col-span-2">
        <SectionHeader
          icon={<Zap className="w-4 h-4" />}
          title="Expansion & Competitive Intel"
        />
        <div className="grid grid-cols-2 gap-6">
          {/* Expansion Signals */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-indigo-500" />
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Expansion Signals
              </h4>
            </div>
            {data.expansion_signals?.length ? (
              <div className="flex flex-col gap-1.5">
                {data.expansion_signals.map((signal: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-gray-700">{signal.text || signal}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No expansion signals yet.</p>
            )}
          </div>

          {/* Competitive Intel */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3.5 h-3.5 text-orange-500" />
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Competitive Intel
              </h4>
            </div>
            {data.competitive_intel?.length ? (
              <div className="flex flex-col gap-1.5">
                {data.competitive_intel.map((intel: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-gray-700">{intel.text || intel}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No competitive intel yet.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
