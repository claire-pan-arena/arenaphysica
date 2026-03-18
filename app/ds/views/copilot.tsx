"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Sparkles, X, Send, FileText, Upload, Check, ChevronDown } from "lucide-react";

/* ─── Types ─── */
interface Question {
  id: string;
  label: string;
  type: "select" | "buttons" | "text";
  options?: { value: string; label: string }[];
  allow_custom?: boolean;
  custom_placeholder?: string;
  placeholder?: string;
}

interface Message {
  id: string;
  role: "agent" | "user";
  text: string;
  hasNotion?: boolean;
  mode?: string;
  importId?: string;
  questions?: Question[];
}

const QUICK_ACTIONS = [
  "Prep for next meeting",
  "Summarize this week",
  "Draft a recap email",
  "Show stale contacts",
  "Expansion opportunities",
  "Import Notion notes",
];

/** Detect Notion URLs in text */
function hasNotionUrl(text: string): boolean {
  return /https?:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s)]+/i.test(text);
}

/** Extract JSON action blocks from Co-pilot responses */
function extractJsonActions(text: string): { action: string; data: any }[] {
  const blocks: { action: string; data: any }[] = [];
  const regex = /```json\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action && parsed.data) {
        blocks.push(parsed);
      }
    } catch {
      // Skip invalid JSON
    }
  }
  return blocks;
}

/** Execute a Co-pilot action */
async function executeAction(action: { action: string; data: any }): Promise<string> {
  try {
    switch (action.action) {
      case "create_deployment": {
        const res = await fetch("/api/ds/deployments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.data),
        });
        const d = await res.json();
        return d.id ? `Created deployment "${action.data.name}" (${d.id})` : `Error: ${d.error}`;
      }
      case "create_people": {
        const results: string[] = [];
        let groupId = action.data.group_id;
        if (!groupId && action.data.group_name && action.data.deployment_id) {
          const gRes = await fetch("/api/ds/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: action.data.group_name, deployment_id: action.data.deployment_id }),
          });
          const g = await gRes.json();
          groupId = g.id;
          results.push(`Created group "${action.data.group_name}"`);
        }
        if (action.data.people) {
          for (const person of action.data.people) {
            const res = await fetch("/api/ds/people", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...person, deployment_id: action.data.deployment_id, group_id: groupId || null }),
            });
            if (res.ok) {
              results.push(`Added ${person.name}`);
            } else {
              const err = await res.json();
              results.push(`Failed to add ${person.name}: ${err.error || "unknown error"}`);
            }
          }
        }
        return results.join(", ");
      }
      case "save_import": {
        const res = await fetch("/api/ds/import/notion", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.data),
        });
        const d = await res.json();
        if (d.success) {
          const parts = [];
          if (d.people_created) parts.push(`${d.people_created} contacts created`);
          if (d.people_updated) parts.push(`${d.people_updated} contacts updated`);
          if (d.meeting_created) parts.push("1 meeting logged");
          if (d.action_items_created) parts.push(`${d.action_items_created} action items`);
          if (d.topics_created) parts.push(`${d.topics_created} topics`);
          return `Saved! ${parts.join(", ")}.`;
        }
        return `Error: ${d.error}`;
      }
      default:
        return `Unknown action: ${action.action}`;
    }
  } catch (e: any) {
    return `Error executing action: ${e.message}`;
  }
}

/** Simple markdown renderer for Co-pilot messages */
function renderMarkdown(text: string): ReactNode {
  // Remove JSON code blocks from visible text
  const cleaned = text.replace(/```json\s*\n[\s\S]*?```/g, "").trim();
  if (!cleaned) return null;

  const lines = cleaned.split("\n");
  const elements: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("## ")) {
      elements.push(
        <div key={i} className="font-semibold text-[13px] text-gray-900 mt-2 mb-1">
          {renderInline(line.slice(3))}
        </div>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex items-start gap-1.5 ml-1">
          <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      elements.push(
        <div key={i} className="flex items-start gap-1.5 ml-1">
          <span className="text-gray-500 shrink-0 font-medium">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<div key={i}>{renderInline(line)}</div>);
    }
  }

  return <>{elements}</>;
}

/** Render inline markdown (bold, etc.) */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

/* ─── Interactive Question Component ─── */
function QuestionUI({
  questions,
  onAnswer,
}: {
  questions: Question[];
  onAnswer: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const allAnswered = questions.every(
    (q) => answers[q.id] || (q.type === "text" && !q.options) // text fields are optional
  );

  const handleSubmit = () => {
    const finalAnswers: Record<string, string> = {};
    for (const q of questions) {
      if (answers[q.id] === "__custom__") {
        finalAnswers[q.id] = customInputs[q.id] || "";
      } else if (answers[q.id]) {
        finalAnswers[q.id] = answers[q.id];
      } else if (q.type === "text") {
        finalAnswers[q.id] = customInputs[q.id] || "";
      }
    }
    onAnswer(finalAnswers);
  };

  return (
    <div className="flex flex-col gap-3 mt-2">
      {questions.map((q) => (
        <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-2.5">
          <label className="block text-[11px] font-medium text-gray-700 mb-1.5">
            {q.label}
          </label>

          {q.type === "select" && (
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <select
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  className="w-full appearance-none rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[12px] text-gray-800 outline-none focus:border-indigo-500"
                >
                  <option value="">Select...</option>
                  {q.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  {q.allow_custom && <option value="__custom__">+ Create new...</option>}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
              {answers[q.id] === "__custom__" && (
                <input
                  value={customInputs[q.id] || ""}
                  onChange={(e) => setCustomInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.custom_placeholder || "Type here..."}
                  className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-500"
                />
              )}
            </div>
          )}

          {q.type === "buttons" && (
            <div className="flex flex-wrap gap-1.5">
              {q.options?.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setAnswer(q.id, o.value)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    answers[q.id] === o.value
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {answers[q.id] === o.value && <Check className="w-3 h-3 inline mr-1" />}
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {q.type === "text" && (
            <input
              value={customInputs[q.id] || ""}
              onChange={(e) => setCustomInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder={q.placeholder || "Type here..."}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-indigo-500"
            />
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className="self-end rounded-lg bg-indigo-500 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-600 disabled:opacity-40 transition-colors"
      >
        Submit Answers
      </button>
    </div>
  );
}

/* ─── Main Co-Pilot Panel ─── */
export default function CoPilotPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Hey! I'm your DS Co-Pilot. Ask me anything about your deployments, prep for meetings, or paste a Notion link to import notes.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; data: any } | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeQuestions, pendingAction]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;

    const notionDetected = hasNotionUrl(text);
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: text.trim(),
      hasNotion: notionDetected,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setActiveQuestions(null);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          text: m.text,
        }));

      const res = await fetch("/api/ds/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          conversation_history: history,
          mode: notionDetected ? "import" : undefined,
        }),
      });
      const data = await res.json();
      const replyText = data.reply || "I'll have a better answer once the Co-Pilot API is connected.";

      const agentMsg: Message = {
        id: `a-${Date.now()}`,
        role: "agent",
        text: replyText,
        hasNotion: data.has_notion_context,
        mode: data.mode,
        importId: data.import_id,
        questions: data.questions,
      };
      setMessages((prev) => [...prev, agentMsg]);

      // Show interactive questions if returned
      if (data.questions && data.questions.length > 0) {
        setActiveQuestions(data.questions);
      }

      // Handle JSON action blocks
      const actions = extractJsonActions(replyText);
      for (const action of actions) {
        if (action.action === "save_import") {
          // Confirmation gate — don't auto-execute
          setPendingAction(action);
        } else {
          // Auto-execute onboarding actions
          const result = await executeAction(action);
          setMessages((prev) => [
            ...prev,
            {
              id: `sys-${Date.now()}-${Math.random()}`,
              role: "agent",
              text: `✅ ${result}`,
            },
          ]);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "agent", text: "Co-Pilot encountered a network error. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleQuestionAnswer = (answers: Record<string, string>) => {
    // Format answers as a readable message and send to Co-pilot
    const parts: string[] = [];
    for (const [key, value] of Object.entries(answers)) {
      if (value) parts.push(`${key}: ${value}`);
    }
    const text = parts.join(", ");
    setActiveQuestions(null);
    sendMessage(text);
  };

  const confirmSave = async () => {
    if (!pendingAction) return;
    const result = await executeAction(pendingAction);
    setMessages((prev) => [
      ...prev,
      { id: `sys-${Date.now()}`, role: "agent", text: `✅ ${result}` },
    ]);
    setPendingAction(null);
  };

  return (
    <div
      className="flex flex-col border-l border-gray-200 bg-white shrink-0"
      style={{ width: 380 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">DS Co-Pilot</span>
          <span className="text-[10px] text-gray-400 font-mono">Opus 4.6</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[90%]">
              {/* Badges */}
              {msg.hasNotion && msg.role === "user" && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-indigo-500">
                  <FileText className="w-3 h-3" /> Notion page attached
                </div>
              )}
              {msg.mode === "import" && msg.role === "agent" && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-amber-600">
                  <Upload className="w-3 h-3" /> Import Mode
                </div>
              )}
              {/* Message content */}
              <div
                className={`rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-500 text-white whitespace-pre-wrap"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.role === "agent" ? renderMarkdown(msg.text) : msg.text}
              </div>
            </div>
          </div>
        ))}

        {/* Interactive questions UI */}
        {activeQuestions && activeQuestions.length > 0 && !sending && (
          <div className="flex justify-start">
            <div className="max-w-[95%] w-full">
              <QuestionUI questions={activeQuestions} onAnswer={handleQuestionAnswer} />
            </div>
          </div>
        )}

        {/* Pending save confirmation */}
        {pendingAction && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-[12px] font-semibold text-indigo-700 mb-2">Ready to save to dashboard:</p>
              <div className="text-[11px] text-gray-700 space-y-1">
                {pendingAction.data.people?.length > 0 && (
                  <p>👥 {pendingAction.data.people.length} contact{pendingAction.data.people.length !== 1 ? "s" : ""}</p>
                )}
                {pendingAction.data.meeting?.date && (
                  <p>📋 Meeting on {pendingAction.data.meeting.date}</p>
                )}
                {pendingAction.data.action_items?.length > 0 && (
                  <p>✅ {pendingAction.data.action_items.length} action item{pendingAction.data.action_items.length !== 1 ? "s" : ""}</p>
                )}
                {pendingAction.data.topics?.length > 0 && (
                  <p>📝 {pendingAction.data.topics.length} topic{pendingAction.data.topics.length !== 1 ? "s" : ""}</p>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={confirmSave}
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-600 transition-colors"
                >
                  Confirm Save
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-3 py-2 text-[13px] text-gray-400">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => {
                if (action === "Import Notion notes") {
                  setInput("Import this Notion page: ");
                } else {
                  sendMessage(action);
                }
              }}
              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        {hasNotionUrl(input) && (
          <div className="flex items-center gap-1 mb-2 text-[10px] text-indigo-500">
            <FileText className="w-3 h-3" /> Notion link detected — will fetch and analyze
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask your Co-Pilot or paste a Notion link..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
