"use client";

import { useEffect, useState, useCallback } from "react";

interface ActionItem {
  id: string;
  text: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  deadline: string;
  notes: string;
  suggested: boolean;
  dismissed: boolean;
}

interface CalendarEvent {
  title: string;
  time: string;
  date?: string;
  location: string | null;
  attendees: number;
}

const CUSTOMERS = /anduril|bausch|b\+l|b&l|mercedes|amd/i;
const QBR_PATTERN = /qbr|mbr|steering\s*committee/i;

function extractCustomerName(title: string): string {
  const match = title.match(/anduril|bausch|b\+l|b&l|mercedes|amd/i);
  if (!match) return "";
  const name = match[0].toLowerCase();
  if (name === "b+l" || name === "b&l") return "Bausch";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateSuggestions(events: CalendarEvent[]): ActionItem[] {
  const suggestions: ActionItem[] = [];

  for (const event of events) {
    const title = event.title;
    if (!CUSTOMERS.test(title)) continue;

    if (QBR_PATTERN.test(title)) {
      const customer = extractCustomerName(title);
      const meetingType = /qbr/i.test(title) ? "QBR" : /mbr/i.test(title) ? "MBR" : "Steering Committee";
      suggestions.push({
        id: `sug-pres-${title}`,
        text: `Create Presentation for ${customer} ${meetingType}`,
        done: false,
        priority: "high",
        deadline: "",
        notes: "",
        suggested: true,
        dismissed: false,
      });
    }

    suggestions.push({
      id: `sug-${title}`,
      text: `Write Agenda for ${title}`,
      done: false,
      priority: "medium",
      deadline: "",
      notes: "",
      suggested: true,
      dismissed: false,
    });
  }

  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

const STORAGE_KEY = "gc-action-items";

function loadItems(): ActionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveItems(items: ActionItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function suggestActionName(eventTitle: string): string {
  if (QBR_PATTERN.test(eventTitle) && CUSTOMERS.test(eventTitle)) {
    const customer = extractCustomerName(eventTitle);
    const meetingType = /qbr/i.test(eventTitle) ? "QBR" : /mbr/i.test(eventTitle) ? "MBR" : "Steering Committee";
    return `Create Presentation for ${customer} ${meetingType}`;
  }
  return `Write Agenda for ${eventTitle}`;
}

function suggestDeadline(eventTitle: string, eventDate: string): string {
  if (!eventDate) return "";
  const d = new Date(eventDate + "T00:00:00");
  if (QBR_PATTERN.test(eventTitle)) {
    d.setDate(d.getDate() - 10);
  } else {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().split("T")[0];
}

interface CreateModalProps {
  eventTitle: string;
  eventDate: string;
  onClose: () => void;
  onCreate: (item: { text: string; priority: "low" | "medium" | "high"; deadline: string; notes: string }) => void;
}

function dayBefore(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function CreateActionModal({ eventTitle, eventDate, onClose, onCreate }: CreateModalProps) {
  const [text, setText] = useState(suggestActionName(eventTitle));
  const [priority, setPriority] = useState<"low" | "medium" | "high">(QBR_PATTERN.test(eventTitle) ? "high" : "medium");
  const [deadline, setDeadline] = useState(suggestDeadline(eventTitle, eventDate));
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-[#8a9a5b]/20 bg-[#2d3a2e]/95 p-6 backdrop-blur-xl shadow-2xl">
        <h3 className="mb-5 text-[11px] font-medium tracking-widest text-[#a09570] uppercase">
          Create Action Item
        </h3>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] tracking-widest text-[#9a9da6] uppercase">Name</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 outline-none focus:border-[#8a9a5b]/35"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] tracking-widest text-[#9a9da6] uppercase">Priority</label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[11px] tracking-widest uppercase transition-all ${
                    priority === p
                      ? p === "high"
                        ? "bg-red-500/20 text-red-300 border border-red-400/30"
                        : p === "medium"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                          : "bg-[#8a9a5b]/15 text-[#c5b9a8] border border-[#8a9a5b]/25"
                      : "bg-[#2d3a2e]/60 text-[#9a9da6] border border-[#9a9da6]/15 hover:bg-[#2d3a2e]/80"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] tracking-widest text-[#9a9da6] uppercase">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] outline-none focus:border-[#8a9a5b]/35 [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] tracking-widest text-[#9a9da6] uppercase">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes..."
              rows={3}
              className="w-full rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 outline-none focus:border-[#8a9a5b]/35 resize-none"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#9a9da6]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-xs tracking-widest text-[#9a9da6] uppercase transition-all hover:bg-[#2d3a2e]/80"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (text.trim()) {
                  onCreate({ text: text.trim(), priority, deadline, notes: notes.trim() });
                }
              }}
              className="flex-1 rounded-lg border border-[#8a9a5b]/30 bg-[#8a9a5b]/20 px-4 py-2.5 text-xs tracking-widest text-[#c5b9a8] uppercase transition-all hover:bg-[#8a9a5b]/30"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EnabledTool {
  id: string;
  name: string;
}

// Map tool keywords to help match action items to relevant tools
const TOOL_KEYWORDS: Record<string, string[]> = {
  "weekly-agenda": ["agenda", "weekly plan", "weekly agenda"],
  "travel-organizer": ["travel", "flight", "hotel", "logistics", "visit"],
  "meeting-report": ["meeting report", "meeting notes", "compile notes", "notes for"],
  "design-canvas": ["design", "rf design", "hardware"],
  "customer-crm": ["crm", "customer profile", "deal"],
  "deployment-tracker": ["deployment", "deploy", "hardware status"],
};

function findMatchingTool(text: string, tools: EnabledTool[]): EnabledTool | null {
  const lower = text.toLowerCase();
  for (const tool of tools) {
    const keywords = TOOL_KEYWORDS[tool.id];
    if (keywords && keywords.some((kw) => lower.includes(kw))) {
      return tool;
    }
    // Fallback: check if any significant word from tool name appears in action item
    const toolWords = tool.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (toolWords.some((w) => lower.includes(w))) {
      return tool;
    }
  }
  return null;
}

interface TodosProps {
  events: CalendarEvent[];
  modalEvent?: { title: string; date: string } | null;
  onModalClose?: () => void;
  enabledTools?: EnabledTool[];
}

export default function Todos({ events, modalEvent, onModalClose, enabledTools = [] }: TodosProps) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    setItems(loadItems());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveItems(items);
  }, [items, loaded]);

  const suggestions = generateSuggestions(events);
  const dismissedIds = new Set(items.filter((t) => t.dismissed).map((t) => t.id));
  const acceptedIds = new Set(items.filter((t) => t.suggested && !t.dismissed).map((t) => t.id));
  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(s.id) && !acceptedIds.has(s.id)
  );

  const manualItems = items.filter((t) => !t.dismissed && (!t.suggested || acceptedIds.has(t.id)));

  const addItem = useCallback(() => {
    if (!newItem.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        text: newItem.trim(),
        done: false,
        priority: "medium",
        deadline: "",
        notes: "",
        suggested: false,
        dismissed: false,
      },
    ]);
    setNewItem("");
  }, [newItem]);

  const createFromModal = (data: { text: string; priority: "low" | "medium" | "high"; deadline: string; notes: string }) => {
    setItems((prev) => [
      ...prev,
      {
        id: `cal-${Date.now()}`,
        text: data.text,
        done: false,
        priority: data.priority,
        deadline: data.deadline,
        notes: data.notes,
        suggested: false,
        dismissed: false,
      },
    ]);
    onModalClose?.();
  };

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  const acceptSuggestion = (suggestion: ActionItem) => {
    setItems((prev) => [...prev, { ...suggestion }]);
  };

  const dismissSuggestion = (id: string) => {
    setItems((prev) => [
      ...prev,
      { id, text: "", done: false, priority: "medium", deadline: "", notes: "", suggested: true, dismissed: true },
    ]);
  };

  const activeItems = manualItems.filter((t) => !t.done);
  const completedItems = manualItems.filter((t) => t.done);

  const priorityDot = (p: string) => {
    if (p === "high") return "bg-red-400/70";
    if (p === "medium") return "bg-amber-400/70";
    return "bg-[#9a9da6]/50";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Modal */}
      {modalEvent && (
        <CreateActionModal
          eventTitle={modalEvent.title}
          eventDate={modalEvent.date}
          onClose={() => onModalClose?.()}
          onCreate={createFromModal}
        />
      )}

      {/* Add input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addItem();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add an action item..."
          className="flex-1 rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 backdrop-blur-xl outline-none transition-colors focus:border-[#8a9a5b]/35"
        />
        <button
          type="submit"
          className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 px-4 py-2.5 text-xs tracking-widest text-[#c5b9a8] uppercase backdrop-blur-xl transition-all hover:border-[#8a9a5b]/35 hover:bg-[#2d3a2e]/85"
        >
          Add
        </button>
      </form>

      {/* Suggested from calendar */}
      {visibleSuggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-widest text-[#a09570]/60 uppercase">
            Suggested from your calendar
          </p>
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex items-center justify-between rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/50 px-4 py-3 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <svg className="h-3.5 w-3.5 text-[#8a9a5b]/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                <span className="text-sm text-[#c5b9a8]">{suggestion.text}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => acceptSuggestion(suggestion)} className="p-1.5 text-[#9a9da6]/40 transition-colors hover:text-[#8a9a5b]" title="Accept">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </button>
                <button onClick={() => dismissSuggestion(suggestion.id)} className="p-1.5 text-[#9a9da6]/40 transition-colors hover:text-[#e8e5e0]" title="Dismiss">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active items */}
      {activeItems.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const isOverdue = item.deadline && new Date(item.deadline + "T23:59:59") < new Date();
            const matchedTool = findMatchingTool(item.text, enabledTools);
            return (
              <div
                key={item.id}
                className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 px-4 py-3 backdrop-blur-xl transition-all hover:border-[#8a9a5b]/35"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                      className="h-4 w-4 shrink-0 rounded-sm border border-[#9a9da6]/40 transition-colors hover:border-[#8a9a5b]"
                    />
                    <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot(item.priority)}`} />
                    <span className="text-sm text-[#e8e5e0]">{item.text}</span>
                    {isOverdue && (
                      <span className="text-[10px] text-red-400/80 font-medium">OVERDUE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {matchedTool && (
                      <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="flex items-center gap-1.5 rounded-md border border-[#8a9a5b]/20 bg-[#8a9a5b]/10 px-2 py-1 text-[#8a9a5b] transition-all hover:bg-[#8a9a5b]/20 hover:border-[#8a9a5b]/40"
                        title={`Open ${matchedTool.name}`}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743" />
                        </svg>
                        <span className="text-[9px] tracking-wider uppercase">{matchedTool.name}</span>
                      </button>
                    )}
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1 text-[#9a9da6]/30 transition-colors hover:text-[#e8e5e0]"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-3 ml-[3.25rem] flex flex-col gap-2 border-t border-[#8a9a5b]/10 pt-3">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] tracking-widest text-[#9a9da6]/50 uppercase">Priority</span>
                      <span className={`text-[11px] font-medium ${
                        item.priority === "high" ? "text-red-400" : item.priority === "medium" ? "text-amber-400" : "text-[#9a9da6]"
                      }`}>
                        {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] tracking-widest text-[#9a9da6]/50 uppercase">Deadline</span>
                      <span className={`text-[11px] ${isOverdue ? "text-red-400/80 font-medium" : "text-[#e8e5e0]/70"}`}>
                        {item.deadline || "None"}
                      </span>
                    </div>
                    {item.notes && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] tracking-widest text-[#9a9da6]/50 uppercase">Notes</span>
                        <p className="text-[11px] text-[#e8e5e0]/60 leading-relaxed">{item.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed toggle */}
      {completedItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-[10px] tracking-widest text-[#9a9da6]/40 uppercase hover:text-[#9a9da6]/60 transition-colors"
          >
            <svg className={`h-3 w-3 transition-transform ${showCompleted ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            Completed ({completedItems.length})
          </button>
          {showCompleted && completedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/40 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleItem(item.id)}
                  className="flex h-4 w-4 items-center justify-center rounded-sm border border-[#8a9a5b]/25 text-[#8a9a5b]/50"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </button>
                <span className="text-sm text-[#9a9da6]/50 line-through">{item.text}</span>
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                className="p-1 text-[#9a9da6]/20 transition-colors hover:text-[#9a9da6]/50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {activeItems.length === 0 && completedItems.length === 0 && visibleSuggestions.length === 0 && (
        <div className="rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/50 p-6 text-center">
          <p className="text-sm text-[#9a9da6]">No action items yet. Add one above.</p>
        </div>
      )}
    </div>
  );
}
