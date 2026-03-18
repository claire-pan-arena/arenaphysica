"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  Modal,
  InputField,
  HealthDot,
  type Deployment,
  type Group,
  type Person,
  type Workstream,
  type Meeting,
  type MeetingActionItem,
  type WeeklySnapshot,
  type SnapshotItem,
} from "../components/shared";

/* ─── Helper: radio group for health ─── */
function HealthRadio({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Health</label>
      <div className="flex items-center gap-4">
        {(["green", "yellow", "red"] as const).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onChange(h)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
              value === h
                ? "border-gray-400 bg-gray-50 font-medium"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <HealthDot health={h} size={10} />
            {h.charAt(0).toUpperCase() + h.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Helper: sentiment picker ─── */
function SentimentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { key: "positive", label: "Positive", color: "text-green-600 border-green-300 bg-green-50" },
    { key: "neutral", label: "Neutral", color: "text-amber-600 border-amber-300 bg-amber-50" },
    { key: "negative", label: "Negative", color: "text-red-600 border-red-300 bg-red-50" },
  ];
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Sentiment</label>
      <div className="flex items-center gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              value === o.key ? o.color : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Helper: priority picker ─── */
function PriorityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { key: "P0", color: "text-red-600 border-red-300 bg-red-50" },
    { key: "P1", color: "text-amber-600 border-amber-300 bg-amber-50" },
    { key: "P2", color: "text-blue-600 border-blue-300 bg-blue-50" },
  ];
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
      <div className="flex items-center gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              value === o.key ? o.color : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {o.key}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Form footer ─── */
function FormFooter({
  onCancel,
  onSave,
  saving,
  saveLabel = "Save",
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
      <button
        onClick={onCancel}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : saveLabel}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DeploymentForm
   ═══════════════════════════════════════════ */
export function DeploymentForm({
  deployment,
  onClose,
  onSaved,
}: {
  deployment?: Deployment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(deployment?.name || "");
  const [company, setCompany] = useState(deployment?.company || "");
  const [companySearch, setCompanySearch] = useState(deployment?.company || "");
  const [companies, setCompanies] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(deployment?.start_date || "");
  const [health, setHealth] = useState(deployment?.health || "green");
  const [status, setStatus] = useState(deployment?.status || "prospect");
  const [notes, setNotes] = useState(deployment?.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/ds/deployments?companies_only=true")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    const method = deployment ? "PUT" : "POST";
    await fetch("/api/ds/deployments", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deployment?.id, name, company: companySearch || company, start_date: startDate, health, status, notes }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={deployment ? "Edit Deployment" : "New Deployment"}>
      <div className="flex flex-col gap-4">
        <InputField label="Deployment Name" value={name} onChange={setName} required placeholder="e.g., Mobile App, Ghost Support Platform" />
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Company <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            value={companySearch}
            onChange={(e) => {
              setCompanySearch(e.target.value);
              setCompany(e.target.value);
            }}
            placeholder="Type or select a company..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            list="company-list"
          />
          <datalist id="company-list">
            {companies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <InputField label="Start Date" type="date" value={startDate} onChange={setStartDate} />
        <HealthRadio value={health} onChange={setHealth} />
        <InputField
          label="Status"
          type="select"
          value={status}
          onChange={setStatus}
          options={[
            { value: "prospect", label: "Prospect" },
            { value: "alpha", label: "Alpha" },
            { value: "beta", label: "Beta" },
            { value: "pilot", label: "Pilot" },
            { value: "scaling", label: "Scaling" },
            { value: "fully_deployed", label: "Fully Deployed" },
          ]}
        />
        <InputField label="Notes" type="textarea" value={notes} onChange={setNotes} />
        <FormFooter onCancel={onClose} onSave={save} saving={saving} />
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   GroupForm
   ═══════════════════════════════════════════ */
export function GroupForm({
  group,
  deploymentId,
  onClose,
  onSaved,
}: {
  group?: Group | null;
  deploymentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [health, setHealth] = useState(group?.health || "green");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const method = group ? "PUT" : "POST";
    await fetch("/api/ds/groups", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: group?.id,
        name,
        description,
        health,
        deployment_id: group?.deployment_id || deploymentId,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={group ? "Edit Group" : "New Group"}>
      <div className="flex flex-col gap-4">
        <InputField label="Name" value={name} onChange={setName} required />
        <InputField label="Description" type="textarea" value={description} onChange={setDescription} />
        <HealthRadio value={health} onChange={setHealth} />
        <FormFooter onCancel={onClose} onSave={save} saving={saving} />
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   PersonForm
   ═══════════════════════════════════════════ */
export function PersonForm({
  person,
  groupId,
  deploymentId: propDeploymentId,
  onClose,
  onSaved,
}: {
  person?: Person | null;
  groupId?: string;
  deploymentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(person?.name || "");
  const [personCompany, setPersonCompany] = useState(person?.company || "");
  const [role, setRole] = useState(person?.role || "");
  const [email, setEmail] = useState(person?.email || "");
  const [deploymentId, setDeploymentId] = useState(person?.deployment_id || propDeploymentId || "");
  const [groupIdVal, setGroupIdVal] = useState(person?.group_id || groupId || "");
  const [isChampion, setIsChampion] = useState(person?.is_champion || false);
  const [sentiment, setSentiment] = useState(person?.sentiment || "neutral");
  const [funFact, setFunFact] = useState(person?.fun_fact || "");
  const [notes, setNotes] = useState(person?.notes || "");
  const [lastContact, setLastContact] = useState(person?.last_contact || "");
  const [reportsTo, setReportsTo] = useState(person?.reports_to || "");
  const [deployments, setDeployments] = useState<{ value: string; label: string }[]>([]);
  const [groups, setGroups] = useState<{ value: string; label: string }[]>([]);
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch deployments on mount
  useEffect(() => {
    fetch("/api/ds/deployments")
      .then((r) => r.json())
      .then((d) => {
        const list = d.deployments || d || [];
        setDeployments(list.map((dep: any) => ({
          value: dep.id,
          label: dep.name ? `${dep.name} (${dep.company})` : dep.company,
        })));
      })
      .catch(() => {});
  }, []);

  // Fetch groups filtered by deployment, and people for Reports To
  useEffect(() => {
    if (deploymentId) {
      fetch(`/api/ds/groups?deployment_id=${deploymentId}`)
        .then((r) => r.json())
        .then((d) => {
          const list = d.groups || d || [];
          setGroups(list.map((g: any) => ({ value: g.id, label: g.name })));
        })
        .catch(() => setGroups([]));
      fetch(`/api/ds/people?deployment_id=${deploymentId}`)
        .then((r) => r.json())
        .then((d) => {
          const list = d.people || d || [];
          setPeople(list.filter((p: any) => p.id !== person?.id).map((p: any) => ({ value: p.id, label: p.name })));
        })
        .catch(() => setPeople([]));
    } else {
      setGroups([]);
      fetch("/api/ds/people")
        .then((r) => r.json())
        .then((d) => {
          const list = d.people || d || [];
          setPeople(list.filter((p: any) => p.id !== person?.id).map((p: any) => ({ value: p.id, label: p.name })));
        })
        .catch(() => setPeople([]));
    }
  }, [deploymentId]);

  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (!deploymentId) { setError("Please select a deployment."); return; }
    setSaving(true);
    const method = person ? "PUT" : "POST";
    const res = await fetch("/api/ds/people", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: person?.id,
        name,
        role,
        email,
        company: personCompany,
        deployment_id: deploymentId,
        group_id: groupIdVal || null,
        is_champion: isChampion,
        sentiment,
        fun_fact: funFact,
        notes,
        last_contact: lastContact,
        reports_to: reportsTo,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to save person.");
      return;
    }
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={person ? "Edit Person" : "Add Person"} wide>
      <div className="grid grid-cols-2 gap-4">
        {error && (
          <div className="col-span-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}
        {deployments.length === 0 && !person && (
          <div className="col-span-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-700">
            You need to create a deployment first. Go to Deployments → + New Deployment.
          </div>
        )}
        <InputField label="Name" value={name} onChange={setName} required />
        <InputField label="Company" value={personCompany} onChange={setPersonCompany} placeholder="e.g., Anduril, JMPRC" />
        <InputField
          label="Deployment"
          type="select"
          value={deploymentId}
          onChange={(v) => { setDeploymentId(v); setGroupIdVal(""); }}
          options={deployments}
          required
        />
        <InputField label="Role" value={role} onChange={setRole} />
        <InputField label="Email" type="email" value={email} onChange={setEmail} />
        <InputField
          label="Group (optional — for org chart)"
          type="select"
          value={groupIdVal}
          onChange={setGroupIdVal}
          options={groups}
        />
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Champion</label>
          <button
            type="button"
            onClick={() => setIsChampion(!isChampion)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              isChampion
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {isChampion ? "Champion" : "Not Champion"}
          </button>
        </div>
        <SentimentPicker value={sentiment} onChange={setSentiment} />
        <InputField label="Last Contact" type="date" value={lastContact} onChange={setLastContact} />
        <InputField
          label="Reports To"
          type="select"
          value={reportsTo}
          onChange={setReportsTo}
          options={people}
        />
        <div className="col-span-2">
          <InputField label="Fun Fact" value={funFact} onChange={setFunFact} placeholder="Something memorable about this person..." />
        </div>
        <div className="col-span-2">
          <InputField label="Notes" type="textarea" value={notes} onChange={setNotes} />
        </div>
        <div className="col-span-2">
          <FormFooter onCancel={onClose} onSave={save} saving={saving} />
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   WorkstreamForm
   ═══════════════════════════════════════════ */
export function WorkstreamForm({
  workstream,
  groupId,
  isInternal,
  onClose,
  onSaved,
}: {
  workstream?: Workstream | null;
  groupId?: string;
  isInternal?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(workstream?.name || "");
  const [description, setDescription] = useState(workstream?.description || "");
  const [owner, setOwner] = useState(workstream?.owner || "");
  const [priority, setPriority] = useState(workstream?.priority || "P2");
  const [status, setStatus] = useState(workstream?.status || "todo");
  const [startDate, setStartDate] = useState(workstream?.start_date || "");
  const [dueDate, setDueDate] = useState(workstream?.due_date || "");
  const [internal, setInternal] = useState(workstream?.is_internal ?? isInternal ?? false);
  const [groupIdVal, setGroupIdVal] = useState(workstream?.group_id || groupId || "");
  const [groups, setGroups] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/ds/groups")
      .then((r) => r.json())
      .then((d) => {
        const list = d.groups || d || [];
        setGroups(list.map((g: any) => ({ value: g.id, label: g.name })));
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    const method = workstream ? "PUT" : "POST";
    await fetch("/api/ds/workstreams", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: workstream?.id,
        name,
        description,
        owner,
        priority,
        status,
        start_date: startDate,
        due_date: dueDate,
        is_internal: internal,
        group_id: internal ? null : groupIdVal,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={workstream ? "Edit Workstream" : "New Workstream"}>
      <div className="flex flex-col gap-4">
        <InputField label="Name" value={name} onChange={setName} required />
        <InputField label="Description" type="textarea" value={description} onChange={setDescription} />

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Internal</label>
          <button
            type="button"
            onClick={() => setInternal(!internal)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              internal
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {internal ? "Internal Work" : "Customer Work"}
          </button>
        </div>

        {!internal && (
          <InputField
            label="Group"
            type="select"
            value={groupIdVal}
            onChange={setGroupIdVal}
            options={groups}
          />
        )}

        <InputField label="Owner" value={owner} onChange={setOwner} />
        <PriorityPicker value={priority} onChange={setPriority} />
        <InputField
          label="Status"
          type="select"
          value={status}
          onChange={setStatus}
          options={[
            { value: "todo", label: "To Do" },
            { value: "in_progress", label: "In Progress" },
            { value: "done", label: "Done" },
            { value: "blocked", label: "Blocked" },
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Start Date" type="date" value={startDate} onChange={setStartDate} />
          <InputField label="Due Date" type="date" value={dueDate} onChange={setDueDate} />
        </div>
        <FormFooter onCancel={onClose} onSave={save} saving={saving} />
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   TaskForm
   ═══════════════════════════════════════════ */
export function TaskForm({
  task,
  workstreamId,
  onClose,
  onSaved,
}: {
  task?: any;
  workstreamId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title || "");
  const [owner, setOwner] = useState(task?.owner || "");
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [status, setStatus] = useState(task?.status || "todo");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const method = task ? "PUT" : "POST";
    await fetch("/api/ds/tasks", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task?.id,
        title,
        owner,
        due_date: dueDate,
        status,
        workstream_id: workstreamId,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={task ? "Edit Task" : "Add Task"}>
      <div className="flex flex-col gap-4">
        <InputField label="Title" value={title} onChange={setTitle} required />
        <InputField label="Owner" value={owner} onChange={setOwner} />
        <InputField label="Due Date" type="date" value={dueDate} onChange={setDueDate} />
        <InputField
          label="Status"
          type="select"
          value={status}
          onChange={setStatus}
          options={[
            { value: "todo", label: "To Do" },
            { value: "in_progress", label: "In Progress" },
            { value: "done", label: "Done" },
          ]}
        />
        <FormFooter onCancel={onClose} onSave={save} saving={saving} />
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   MeetingForm  (MOST IMPORTANT FORM)
   ═══════════════════════════════════════════ */
export function MeetingForm({
  meeting,
  onClose,
  onSaved,
}: {
  meeting?: Meeting | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(meeting?.date || today);
  const [groupId, setGroupId] = useState(meeting?.group_id || "");
  const [type, setType] = useState(meeting?.type || "");
  const [attendees, setAttendees] = useState<string[]>(meeting?.attendees || []);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [topics, setTopics] = useState<string[]>(meeting?.topics || []);
  const [topicInput, setTopicInput] = useState("");
  const [notes, setNotes] = useState(meeting?.notes || "");
  const [actionItems, setActionItems] = useState<{ title: string; owner: string }[]>(
    meeting?.action_items?.map((a) => ({ title: a.title, owner: a.owner })) || []
  );
  const [actionTitle, setActionTitle] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [sentiment, setSentiment] = useState(meeting?.sentiment || "neutral");
  const [expansionSignals, setExpansionSignals] = useState(
    meeting?.expansion_signals?.join("\n") || ""
  );
  const [competitiveIntel, setCompetitiveIntel] = useState(
    meeting?.competitive_intel?.join("\n") || ""
  );
  const [agendaSent, setAgendaSent] = useState(meeting?.agenda_sent || false);
  const [recapSent, setRecapSent] = useState(meeting?.recap_sent || false);

  const [groups, setGroups] = useState<{ value: string; label: string }[]>([]);
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/ds/groups")
      .then((r) => r.json())
      .then((d) => {
        const list = d.groups || d || [];
        setGroups(list.map((g: any) => ({ value: g.id, label: `${g.company || ""} - ${g.name}` })));
      })
      .catch(() => {});
    fetch("/api/ds/people")
      .then((r) => r.json())
      .then((d) => {
        const list = d.people || d || [];
        setPeople(list.map((p: any) => ({ value: p.name, label: p.name })));
      })
      .catch(() => {});
  }, []);

  const addAttendee = () => {
    if (attendeeInput.trim() && !attendees.includes(attendeeInput.trim())) {
      setAttendees([...attendees, attendeeInput.trim()]);
      setAttendeeInput("");
    }
  };

  const addTopic = () => {
    if (topicInput.trim()) {
      setTopics([...topics, topicInput.trim()]);
      setTopicInput("");
    }
  };

  const addActionItem = () => {
    if (actionTitle.trim()) {
      setActionItems([...actionItems, { title: actionTitle.trim(), owner: actionOwner.trim() }]);
      setActionTitle("");
      setActionOwner("");
    }
  };

  const save = async () => {
    setSaving(true);
    const method = meeting ? "PUT" : "POST";
    await fetch("/api/ds/meetings", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: meeting?.id,
        date,
        group_id: groupId,
        type,
        attendees,
        topics,
        notes,
        action_items: actionItems.map((a) => ({ title: a.title, owner: a.owner, done: false })),
        sentiment,
        expansion_signals: expansionSignals
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        competitive_intel: competitiveIntel
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        agenda_sent: agendaSent,
        recap_sent: recapSent,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={meeting ? "Edit Meeting" : "Log Meeting"} wide>
      <div className="flex flex-col gap-4">
        {/* Row 1: date, group, type */}
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Date" type="date" value={date} onChange={setDate} required />
          <InputField
            label="Group"
            type="select"
            value={groupId}
            onChange={setGroupId}
            options={groups}
            required
          />
          <InputField
            label="Type"
            type="select"
            value={type}
            onChange={setType}
            options={[
              { value: "kickoff", label: "Kickoff" },
              { value: "weekly_sync", label: "Weekly Sync" },
              { value: "qbr", label: "QBR" },
              { value: "ad_hoc", label: "Ad Hoc" },
              { value: "internal", label: "Internal" },
              { value: "executive", label: "Executive" },
            ]}
            required
          />
        </div>

        {/* Attendees (multi-select via enter-to-add) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Attendees</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attendees.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-700"
              >
                {name}
                <button
                  onClick={() => setAttendees(attendees.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={attendeeInput}
              onChange={(e) => setAttendeeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAttendee();
                }
              }}
              placeholder="Type name and press Enter"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
              list="people-list"
            />
            <datalist id="people-list">
              {people.map((p) => (
                <option key={p.value} value={p.value} />
              ))}
            </datalist>
            <button
              onClick={addAttendee}
              className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Topics (enter-to-add list) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Topics</label>
          {topics.length > 0 && (
            <ul className="list-disc list-inside mb-2 text-sm text-gray-700 space-y-0.5">
              {topics.map((t, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>{t}</span>
                  <button
                    onClick={() => setTopics(topics.filter((_, j) => j !== i))}
                    className="text-gray-300 hover:text-gray-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTopic();
                }
              }}
              placeholder="Type topic and press Enter"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
            />
            <button
              onClick={addTopic}
              className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notes */}
        <InputField label="Notes" type="textarea" value={notes} onChange={setNotes} rows={4} />

        {/* Action Items (enter-to-add with owner) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Action Items</label>
          {actionItems.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              {actionItems.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5 text-sm"
                >
                  <span className="text-gray-800">{a.title}</span>
                  <div className="flex items-center gap-2">
                    {a.owner && (
                      <span className="text-[11px] text-gray-400">{a.owner}</span>
                    )}
                    <button
                      onClick={() => setActionItems(actionItems.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-gray-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addActionItem();
                }
              }}
              placeholder="Action item title"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
            />
            <input
              value={actionOwner}
              onChange={(e) => setActionOwner(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addActionItem();
                }
              }}
              placeholder="Owner"
              className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
            />
            <button
              onClick={addActionItem}
              className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sentiment */}
        <SentimentPicker value={sentiment} onChange={setSentiment} />

        {/* Expansion signals & Competitive intel */}
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Expansion Signals (one per line)"
            type="textarea"
            value={expansionSignals}
            onChange={setExpansionSignals}
            rows={3}
          />
          <InputField
            label="Competitive Intel (one per line)"
            type="textarea"
            value={competitiveIntel}
            onChange={setCompetitiveIntel}
            rows={3}
          />
        </div>

        {/* Checkboxes: agenda sent, recap sent */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={agendaSent}
              onChange={(e) => setAgendaSent(e.target.checked)}
              className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
            />
            Agenda Sent
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={recapSent}
              onChange={(e) => setRecapSent(e.target.checked)}
              className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
            />
            Recap Sent
          </label>
        </div>

        <FormFooter onCancel={onClose} onSave={save} saving={saving} />
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   SnapshotForm
   ═══════════════════════════════════════════ */
export function SnapshotForm({
  snapshot,
  workstreams,
  onClose,
  onSaved,
}: {
  snapshot?: WeeklySnapshot | null;
  workstreams: Workstream[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [weekOf, setWeekOf] = useState(snapshot?.week_of || today);
  const [items, setItems] = useState<SnapshotItem[]>(snapshot?.items || []);
  const [reflections, setReflections] = useState(snapshot?.reflections || "");
  const [saving, setSaving] = useState(false);

  const addWorkstream = (wsId: string) => {
    const ws = workstreams.find((w) => w.id === wsId);
    if (!ws) return;
    if (items.find((i) => i.workstream_id === wsId)) return;
    setItems([
      ...items,
      {
        workstream_id: ws.id,
        workstream_name: ws.name,
        priority: ws.priority,
        status: ws.status,
      },
    ]);
  };

  const updateItem = (idx: number, field: string, value: string) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    const method = snapshot ? "PUT" : "POST";
    await fetch("/api/ds/snapshots", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: snapshot?.id, week_of: weekOf, items, reflections }),
    });
    setSaving(false);
    onSaved();
  };

  const availableWorkstreams = workstreams.filter(
    (ws) => !items.find((i) => i.workstream_id === ws.id)
  );

  return (
    <Modal open onClose={onClose} title={snapshot ? "Edit Snapshot" : "New Weekly Snapshot"} wide>
      <div className="flex flex-col gap-4">
        <InputField label="Week Of" type="date" value={weekOf} onChange={setWeekOf} required />

        {/* Workstream selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Add Workstreams to Snapshot
          </label>
          {availableWorkstreams.length > 0 ? (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addWorkstream(e.target.value);
                  e.target.value = "";
                }
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
            >
              <option value="">Select workstream...</option>
              {availableWorkstreams.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.priority})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-400">All workstreams added.</p>
          )}
        </div>

        {/* Selected items */}
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {item.workstream_name}
                </span>
                <select
                  value={item.priority}
                  onChange={(e) => updateItem(i, "priority", e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-[11px]"
                >
                  <option value="P0">P0</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                </select>
                <select
                  value={item.status}
                  onChange={(e) => updateItem(i, "status", e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-[11px]"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
                <input
                  value={item.notes || ""}
                  onChange={(e) => updateItem(i, "notes", e.target.value)}
                  placeholder="Notes"
                  className="w-36 rounded border border-gray-300 px-2 py-1 text-[11px]"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="text-gray-300 hover:text-gray-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reflections */}
        <InputField
          label="Reflections"
          type="textarea"
          value={reflections}
          onChange={setReflections}
          rows={3}
          placeholder="What went well? What could be improved?"
        />

        <FormFooter onCancel={onClose} onSave={save} saving={saving} />
      </div>
    </Modal>
  );
}
