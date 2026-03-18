"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, FileText, Upload } from "lucide-react";

interface Message {
  id: string;
  role: "agent" | "user";
  text: string;
  hasNotion?: boolean;
  mode?: string;
  importId?: string;
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

/** Try to extract and execute JSON action blocks from Co-pilot responses */
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

/** Execute a Co-pilot action (create deployment, save import, etc.) */
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
        // First create group if needed
        let groupId = action.data.group_id;
        if (!groupId && action.data.group_name && action.data.deployment_id) {
          const gRes = await fetch("/api/ds/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: action.data.group_name,
              deployment_id: action.data.deployment_id,
            }),
          });
          const g = await gRes.json();
          groupId = g.id;
          results.push(`Created group "${action.data.group_name}"`);
        }
        // Then create people
        if (groupId && action.data.people) {
          for (const person of action.data.people) {
            await fetch("/api/ds/people", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...person, group_id: groupId }),
            });
            results.push(`Added ${person.name}`);
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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

    try {
      // Build conversation history for context
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
          mode: notionDetected && /import|upload|ingest|add/i.test(text) ? "import" : undefined,
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
      };
      setMessages((prev) => [...prev, agentMsg]);

      // Auto-execute any JSON action blocks from the response
      const actions = extractJsonActions(replyText);
      if (actions.length > 0) {
        for (const action of actions) {
          const result = await executeAction(action);
          const actionMsg: Message = {
            id: `sys-${Date.now()}-${Math.random()}`,
            role: "agent",
            text: `Action executed: ${result}`,
          };
          setMessages((prev) => [...prev, actionMsg]);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "agent",
          text: "Co-Pilot encountered a network error. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
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
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
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
              {/* Notion badge */}
              {msg.hasNotion && msg.role === "user" && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-indigo-500">
                  <FileText className="w-3 h-3" />
                  Notion page attached
                </div>
              )}
              {msg.mode === "import" && msg.role === "agent" && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-amber-600">
                  <Upload className="w-3 h-3" />
                  Import Mode
                </div>
              )}
              <div
                className={`rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
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
            <FileText className="w-3 h-3" />
            Notion link detected — will fetch and analyze
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
