"use client";

import { useEffect, useState } from "react";
import NavHeader from "../../components/nav-header";

interface MeetingNote {
  id: string;
  content: string;
  customer: string;
  eventTitle: string | null;
  eventDate: string | null;
  creatorName: string;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
}

interface Report {
  id: string;
  customer: string;
  weekStart: string;
  content: string;
  creatorName: string;
  createdAt: string;
}

export default function MeetingReportPage() {
  const [customer, setCustomer] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Template management
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});

    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => setReports(data.reports || []))
      .catch(() => {});
  }, []);

  // Fetch notes when customer changes
  useEffect(() => {
    if (!customer.trim()) { setNotes([]); return; }
    setLoadingNotes(true);
    const params = new URLSearchParams({ customer: customer.trim() });
    if (weekStart) params.set("week", weekStart);
    fetch(`/api/notes?${params}`)
      .then((r) => r.json())
      .then((data) => { setNotes(data.notes || []); setLoadingNotes(false); })
      .catch(() => setLoadingNotes(false));
  }, [customer, weekStart]);

  const generateReport = async () => {
    if (!customer.trim()) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/meeting-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customer.trim(),
          weekStart: weekStart || undefined,
          templateId: selectedTemplate || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult(data.content);
        setReports((prev) => [{
          id: data.id,
          customer: customer.trim(),
          weekStart: weekStart || "",
          content: data.content,
          creatorName: "You",
          createdAt: new Date().toISOString(),
        }, ...prev]);
      }
    } catch {
      setResult("Failed to generate report.");
    }
    setGenerating(false);
  };

  const saveTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTemplateName.trim(), content: newTemplateContent.trim() }),
    });
    const data = await res.json();
    setTemplates((prev) => [...prev, { id: data.id, name: newTemplateName.trim(), content: newTemplateContent.trim() }]);
    setNewTemplateName("");
    setNewTemplateContent("");
    setShowTemplateForm(false);
  };

  const deleteReport = async (id: string) => {
    await fetch("/api/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0" style={{ background: "radial-gradient(ellipse 120% 60% at 50% 80%, rgba(180,160,130,0.3) 0%, transparent 70%)" }} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 400 400" className="h-[800px] w-[800px] animate-[spin_30s_linear_infinite] opacity-[0.05]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
        </svg>
      </div>

      <div className="relative z-10">
        <NavHeader />

        <div className="px-8 py-10 max-w-4xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl text-white" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
                Meeting Report
              </h2>
              <p className="mt-2 text-sm text-white/50">Generate reports from your meeting notes using templates.</p>
            </div>
            <button
              onClick={() => setShowTemplateForm(!showTemplateForm)}
              className="rounded-lg border border-white/20 bg-white/[0.07] px-4 py-2 text-xs tracking-widest text-white/80 uppercase backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/10"
            >
              {showTemplateForm ? "Cancel" : "+ Template"}
            </button>
          </div>

          {/* Template form */}
          {showTemplateForm && (
            <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                Create Report Template
              </h3>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
                />
                <textarea
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  placeholder={"Describe the report structure...\ne.g.\n# Executive Summary\n\n# Key Discussions\n\n# Action Items\n\n# Next Steps"}
                  rows={8}
                  className="rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 resize-none leading-relaxed"
                />
                <button
                  onClick={saveTemplate}
                  className="self-start rounded-lg border border-white/30 bg-white/20 px-5 py-2.5 text-xs tracking-widest text-white/80 uppercase transition-all hover:bg-white/25"
                >
                  Save Template
                </button>
              </div>
            </div>
          )}

          {/* Generate form */}
          <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
            <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
              Generate Report
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[10px] tracking-widest text-white/60 uppercase">Customer</label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="e.g. Anduril"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] tracking-widest text-white/60 uppercase">Week (optional)</label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] tracking-widest text-white/60 uppercase">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]"
                >
                  <option value="">Default structure</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview of notes that will be used */}
            {customer.trim() && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-[10px] tracking-widest text-white/40 uppercase mb-2">
                  {loadingNotes ? "Loading notes..." : `${notes.length} note${notes.length !== 1 ? "s" : ""} found`}
                </p>
                {notes.length > 0 && (
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {notes.map((n) => (
                      <p key={n.id} className="text-[11px] text-white/50 truncate">
                        {n.eventDate && <span className="text-white/30 mr-2">{n.eventDate}</span>}
                        {n.eventTitle && <span className="text-white/60 mr-2">{n.eventTitle}:</span>}
                        {n.content}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={generateReport}
                disabled={generating || !customer.trim() || notes.length === 0}
                className="rounded-lg border border-white/30 bg-white/20 px-5 py-2.5 text-xs tracking-widest text-white/80 uppercase transition-all hover:bg-white/25 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </div>

          {/* Current result */}
          {result && (
            <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                Generated Report
              </h3>
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {result}
              </div>
            </div>
          )}

          {/* Past reports */}
          {reports.length > 0 && (
            <div>
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                Past Reports
              </h3>
              <div className="flex flex-col gap-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl transition-all hover:border-white/20"
                  >
                    <div
                      className="cursor-pointer flex items-start justify-between"
                      onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{report.customer}</p>
                        <p className="mt-1 text-[10px] text-white/30">
                          {report.weekStart && `Week of ${report.weekStart} · `}
                          {report.creatorName} · {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                          className="p-1 text-white/20 hover:text-white transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <svg className={`h-4 w-4 text-white/25 transition-transform ${expandedReport === report.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>
                    {expandedReport === report.id && (
                      <div className="mt-4 border-t border-white/10 pt-4 text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                        {report.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
