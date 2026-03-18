"use client";

import { ReactNode } from "react";
import {
  TrendingUp,
  Minus,
  TrendingDown,
  X,
  Inbox,
} from "lucide-react";

/* ─── Badge ─── */
export function Badge({
  children,
  color = "#6366f1",
  bg = "#eef2ff",
  className = "",
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${className}`}
      style={{ color, backgroundColor: bg }}
    >
      {children}
    </span>
  );
}

/* ─── PriorityBadge ─── */
const PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  P0: { color: "#ef4444", bg: "#fef2f2" },
  P1: { color: "#f59e0b", bg: "#fffbeb" },
  P2: { color: "#3b82f6", bg: "#eff6ff" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority] || { color: "#6b7280", bg: "#f3f4f6" };
  return <Badge color={style.color} bg={style.bg}>{priority}</Badge>;
}

/* ─── StatusBadge ─── */
const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  // Task/workstream statuses
  done: { color: "#16a34a", bg: "#f0fdf4", label: "Done" },
  in_progress: { color: "#3b82f6", bg: "#eff6ff", label: "In Progress" },
  todo: { color: "#6b7280", bg: "#f3f4f6", label: "To Do" },
  blocked: { color: "#dc2626", bg: "#fef2f2", label: "Blocked" },
  // Deployment lifecycle statuses
  prospect: { color: "#6b7280", bg: "#f3f4f6", label: "Prospect" },
  alpha: { color: "#3b82f6", bg: "#eff6ff", label: "Alpha" },
  beta: { color: "#6366f1", bg: "#eef2ff", label: "Beta" },
  pilot: { color: "#d97706", bg: "#fffbeb", label: "Pilot" },
  scaling: { color: "#16a34a", bg: "#f0fdf4", label: "Scaling" },
  fully_deployed: { color: "#059669", bg: "#ecfdf5", label: "Fully Deployed" },
  // Legacy
  active: { color: "#3b82f6", bg: "#eff6ff", label: "Active" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || { color: "#6b7280", bg: "#f3f4f6", label: status };
  return <Badge color={style.color} bg={style.bg}>{style.label}</Badge>;
}

/* ─── SentimentBadge ─── */
export function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === "positive") {
    return (
      <Badge color="#16a34a" bg="#f0fdf4">
        <TrendingUp className="w-3 h-3 mr-1" />
        Positive
      </Badge>
    );
  }
  if (sentiment === "negative") {
    return (
      <Badge color="#dc2626" bg="#fef2f2">
        <TrendingDown className="w-3 h-3 mr-1" />
        Negative
      </Badge>
    );
  }
  return (
    <Badge color="#d97706" bg="#fffbeb">
      <Minus className="w-3 h-3 mr-1" />
      Neutral
    </Badge>
  );
}

/* ─── HealthDot ─── */
const HEALTH_COLORS: Record<string, string> = {
  green: "#16a34a",
  yellow: "#d97706",
  red: "#dc2626",
};

export function HealthDot({ health, size = 10 }: { health: string; size?: number }) {
  const color = HEALTH_COLORS[health] || "#6b7280";
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

/* ─── ProgressBar ─── */
export function ProgressBar({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-500">{label}</span>
          <span className="text-[11px] font-medium text-gray-700">
            {done}/{total}
          </span>
        </div>
      )}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Card ─── */
export function Card({
  children,
  className = "",
  hover = false,
  onClick,
  borderLeft,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  borderLeft?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-[10px] border border-gray-200 p-4 ${
        hover ? "hover:shadow-md hover:border-gray-300 transition-all cursor-pointer" : ""
      } ${className}`}
      style={borderLeft ? { borderLeft: `3px solid ${borderLeft}` } : undefined}
    >
      {children}
    </div>
  );
}

/* ─── SectionHeader ─── */
export function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {count !== undefined && (
          <Badge color="#6366f1" bg="#eef2ff">
            {count}
          </Badge>
        )}
      </div>
      {action}
    </div>
  );
}

/* ─── Modal ─── */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative ${
          wide ? "max-w-3xl" : "max-w-lg"
        } w-full max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ─── InputField ─── */
export function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  rows,
  options,
  required,
}: {
  label: string;
  type?: "text" | "date" | "textarea" | "select" | "email";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  options?: { value: string; label: string }[];
  required?: boolean;
}) {
  const base =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows || 3}
          className={`${base} resize-none`}
        />
      ) : type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Select...</option>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}

/* ─── EmptyState ─── */
export function EmptyState({
  icon,
  message,
}: {
  icon?: ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      {icon || <Inbox className="w-10 h-10 mb-3" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ─── Type definitions shared across views ─── */
export interface Company {
  id: string;
  name: string;
  owner_email: string;
  notes?: string;
  deployment_count?: number;
  people_count?: number;
}

export interface Deployment {
  id: string;
  name: string;
  company: string;
  company_id?: string;
  health: string;
  status: string;
  start_date: string;
  notes?: string;
  groups?: Group[];
}

export interface Group {
  id: string;
  deployment_id: string;
  name: string;
  description: string;
  health: string;
  company?: string;
  workstream_count?: number;
  people_count?: number;
  completion_pct?: number;
  champions?: string[];
}

export interface Person {
  id: string;
  name: string;
  role: string;
  email: string;
  group_id: string;
  group_name?: string;
  company?: string;
  is_champion: boolean;
  sentiment: string;
  fun_fact?: string;
  notes?: string;
  last_contact?: string;
  reports_to?: string;
  company_id?: string;
}

export interface Workstream {
  id: string;
  name: string;
  group_id: string;
  group_name?: string;
  company?: string;
  description: string;
  owner: string;
  priority: string;
  status: string;
  start_date: string;
  due_date: string;
  is_internal: boolean;
  linked_deployment?: string;
  tasks_done?: number;
  tasks_total?: number;
  tasks?: Task[];
}

export interface Task {
  id: string;
  workstream_id: string;
  title: string;
  owner: string;
  due_date: string;
  status: string;
}

export interface Meeting {
  id: string;
  date: string;
  group_id: string;
  group_name?: string;
  company?: string;
  type: string;
  attendees: string[];
  topics: string[];
  notes: string;
  action_items: MeetingActionItem[];
  sentiment: string;
  expansion_signals?: string[];
  competitive_intel?: string[];
  agenda_sent: boolean;
  recap_sent: boolean;
}

export interface MeetingActionItem {
  id: string;
  title: string;
  owner: string;
  done: boolean;
}

export interface WeeklySnapshot {
  id: string;
  week_of: string;
  items: SnapshotItem[];
  reflections?: string;
}

export interface SnapshotItem {
  workstream_id: string;
  workstream_name: string;
  priority: string;
  status: string;
  notes?: string;
}

export interface CommandData {
  needs_attention: { overdue: any[]; due_soon: any[] };
  this_week: SnapshotItem[];
  deployment_health: {
    id: string;
    company: string;
    health: string;
    groups: { name: string; health: string; completion_pct: number }[];
  }[];
  upcoming_deadlines: any[];
  relationship_alerts: any[];
  expansion_signals: any[];
  competitive_intel: any[];
}
