"use client";

import { useEffect, useState } from "react";
import { Settings, Save, CheckCircle2 } from "lucide-react";
import { Card, SectionHeader } from "../components/shared";

const DEFAULT_REPORT_GUIDELINES = `TLDR: Include a one-two sentence synthesis that communicates the main points. Remember a synthesis is not a summary.

Response requested: Specify what response you want from recipients if any.
- FYI / No action needed
- ACK requested — confirm they have read & received
- NACK — respond if they disagree with proposed course of action

Metadata: Attendees, location

Highlights/Details: Structure into relevant buckets (e.g., product, contracting, ML feedback). Bullet points preferred. Be concise, include relevant facts & learnings. Spell out implications.

Next Steps: Always include clear next steps with:
- One responsible name (bold)
- Date / timeline
- Clear asks`;

interface Props {
  onRefresh: () => void;
}

export default function SettingsView({ onRefresh }: Props) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ds/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      await fetch("/api/ds/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch {}
    setSaving(null);
  };

  const [reportGuidelines, setReportGuidelines] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [calendarDays, setCalendarDays] = useState("");
  const [defaultMeetingType, setDefaultMeetingType] = useState("");

  useEffect(() => {
    if (!loading) {
      setReportGuidelines(settings.meeting_report_guidelines || DEFAULT_REPORT_GUIDELINES);
      setEmailDomain(settings.arena_email_domain || "@arena-ai.com");
      setCalendarDays(settings.calendar_days_ahead || "14");
      setDefaultMeetingType(settings.default_meeting_type || "ad_hoc");
    }
  }, [loading, settings]);

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-[10px] border border-gray-200 p-6 animate-pulse">
          <div className="h-5 w-40 rounded bg-gray-100 mb-4" />
          <div className="h-3 w-64 rounded bg-gray-50 mb-2" />
          <div className="h-3 w-48 rounded bg-gray-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* Meeting Report Guidelines */}
      <Card>
        <SectionHeader
          icon={<Settings className="w-4 h-4" />}
          title="Meeting Report Guidelines"
        />
        <p className="text-[12px] text-gray-500 mb-3">
          Template and guidelines for post-meeting reports sent to meeting-reports@arena-ai.com.
          The Co-Pilot will use these when helping draft reports.
        </p>
        <textarea
          value={reportGuidelines}
          onChange={(e) => setReportGuidelines(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-mono text-[12px]"
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          {saved === "meeting_report_guidelines" && (
            <span className="flex items-center gap-1 text-[11px] text-green-600">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
          <button
            onClick={() => saveSetting("meeting_report_guidelines", reportGuidelines)}
            disabled={saving === "meeting_report_guidelines"}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            <Save className="w-3 h-3" />
            {saving === "meeting_report_guidelines" ? "Saving..." : "Save"}
          </button>
        </div>
      </Card>

      {/* General Settings */}
      <Card>
        <SectionHeader
          icon={<Settings className="w-4 h-4" />}
          title="General"
        />
        <div className="flex flex-col gap-4">
          {/* Email Domain */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Internal Email Domain
            </label>
            <p className="text-[11px] text-gray-400 mb-1.5">
              Meetings with only attendees from this domain are considered internal.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => saveSetting("arena_email_domain", emailDomain)}
                disabled={saving === "arena_email_domain"}
                className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {saved === "arena_email_domain" ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Calendar Window */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Calendar Lookahead (days)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={calendarDays}
                onChange={(e) => setCalendarDays(e.target.value)}
                min="7"
                max="30"
                className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => saveSetting("calendar_days_ahead", calendarDays)}
                disabled={saving === "calendar_days_ahead"}
                className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {saved === "calendar_days_ahead" ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Default Meeting Type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Default Meeting Type
            </label>
            <div className="flex items-center gap-2">
              <select
                value={defaultMeetingType}
                onChange={(e) => setDefaultMeetingType(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ad_hoc">Ad Hoc</option>
                <option value="kickoff">Kickoff</option>
                <option value="weekly_sync">Weekly Sync</option>
                <option value="qbr">QBR</option>
                <option value="internal">Internal</option>
                <option value="executive">Executive</option>
              </select>
              <button
                onClick={() => saveSetting("default_meeting_type", defaultMeetingType)}
                disabled={saving === "default_meeting_type"}
                className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {saved === "default_meeting_type" ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
