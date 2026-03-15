"use client";

import { useEffect, useState, useCallback } from "react";

interface ActionItem {
  id: string;
  text: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  deadline: string;
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

function generateSuggestions(events: CalendarEvent[]): ActionItem[] {
  const suggestions: ActionItem[] = [];

  for (const event of events) {
    const title = event.title;
    if (!CUSTOMERS.test(title)) continue;

    suggestions.push({
      id: `sug-${title}`,
      text: `Prepare for ${title}`,
      done: false,
      priority: "medium",
      deadline: "",
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
  const lower = eventTitle.toLowerCase();
  if (/sync|standup|check.?in|1.?on.?1|weekly/i.test(lower)) {
    return `Prepare agenda for ${eventTitle}`;
  }
  if (/demo|presentation|pitch/i.test(lower)) {
    return `Prepare materials for ${eventTitle}`;
  }
  if (/review|retro|debrief/i.test(lower)) {
    return `Compile notes for ${eventTitle}`;
  }
  if (/interview|screening/i.test(lower)) {
    return `Review candidate for ${eventTitle}`;
  }
  return `Follow up on ${eventTitle}`;
}

interface CreateModalProps {
  eventTitle: string;
  eventDate: string;
  onClose: () => void;
  onCreate: (item: { text: string; priority: "low" | "medium" | "high"; deadline: string }) => void;
}

function dayBefore(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function CreateActionModal({ eventTitle, eventDate, onClose, onCreate }: CreateModalProps) {
  const [text, setText] = useState(suggestActionName(eventTitle));
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [deadline, setDeadline] = useState(dayBefore(eventDate));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-white/[0.15] bg-[#3a4050]/95 p-6 backdrop-blur-xl shadow-2xl">
        <h3 className="mb-5 text-[11px] font-medium tracking-widest text-white/50 uppercase">
          Create Action Item
        </h3>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] tracking-widest text-white/30 uppercase">Name</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-white/[0.12] bg-white/10 px-4 py-2.5 text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] tracking-widest text-white/30 uppercase">Priority</label>
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
                          : "bg-white/15 text-white/70 border border-white/20"
                      : "bg-white/[0.06] text-white/40 border border-white/[0.1] hover:bg-white/[0.1]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] tracking-widest text-white/30 uppercase">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-white/[0.12] bg-white/10 px-4 py-2.5 text-sm text-white/90 outline-none focus:border-white/25 [color-scheme:dark]"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.06] px-4 py-2.5 text-xs tracking-widest text-white/40 uppercase transition-all hover:bg-white/[0.1]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (text.trim()) {
                  onCreate({ text: text.trim(), priority, deadline });
                }
              }}
              className="flex-1 rounded-lg border border-white/20 bg-white/20 px-4 py-2.5 text-xs tracking-widest text-white/80 uppercase transition-all hover:bg-white/25"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TodosProps {
  events: CalendarEvent[];
  modalEvent?: { title: string; date: string } | null;
  onModalClose?: () => void;
}

export default function Todos({ events, modalEvent, onModalClose }: TodosProps) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loaded, setLoaded] = useState(false);

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
        suggested: false,
        dismissed: false,
      },
    ]);
    setNewItem("");
  }, [newItem]);

  const createFromModal = (data: { text: string; priority: "low" | "medium" | "high"; deadline: string }) => {
    setItems((prev) => [
      ...prev,
      {
        id: `cal-${Date.now()}`,
        text: data.text,
        done: false,
        priority: data.priority,
        deadline: data.deadline,
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
      { id, text: "", done: false, priority: "medium", deadline: "", suggested: true, dismissed: true },
    ]);
  };

  const activeItems = manualItems.filter((t) => !t.done);
  const completedItems = manualItems.filter((t) => t.done);

  const priorityDot = (p: string) => {
    if (p === "high") return "bg-red-400/70";
    if (p === "medium") return "bg-amber-400/70";
    return "bg-white/30";
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
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/20 px-4 py-2.5 text-sm text-white/90 placeholder-white/30 backdrop-blur-xl outline-none transition-colors focus:border-white/20"
        />
        <button
          type="submit"
          className="rounded-lg border border-white/[0.08] bg-white/20 px-4 py-2.5 text-xs tracking-widest text-white/70 uppercase backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.25]"
        >
          Add
        </button>
      </form>

      {/* Suggested from calendar */}
      {visibleSuggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-widest text-white/30 uppercase">
            Suggested from your calendar
          </p>
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-white/20 px-4 py-3 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <svg className="h-3.5 w-3.5 text-white/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                <span className="text-sm text-white/50">{suggestion.text}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => acceptSuggestion(suggestion)} className="p-1.5 text-white/30 transition-colors hover:text-white/70" title="Accept">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </button>
                <button onClick={() => dismissSuggestion(suggestion.id)} className="p-1.5 text-white/30 transition-colors hover:text-white/70" title="Dismiss">
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
          {activeItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.12] bg-white/20 px-4 py-3 backdrop-blur-xl transition-all hover:border-white/25"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleItem(item.id)}
                  className="h-4 w-4 rounded-sm border border-white/30 transition-colors hover:border-white/60"
                />
                <div className={`h-1.5 w-1.5 rounded-full ${priorityDot(item.priority)}`} />
                <span className="text-sm text-white">{item.text}</span>
                {item.deadline && (
                  <span className={`text-[10px] ${
                    new Date(item.deadline + "T23:59:59") < new Date()
                      ? "text-red-400/80 font-medium"
                      : "text-white/25"
                  }`}>
                    {new Date(item.deadline + "T23:59:59") < new Date() ? "OVERDUE · " : ""}
                    {item.deadline}
                  </span>
                )}
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                className="p-1 text-white/20 transition-colors hover:text-white/60"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {completedItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-widest text-white/20 uppercase">Completed</p>
          {completedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/20 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleItem(item.id)}
                  className="flex h-4 w-4 items-center justify-center rounded-sm border border-white/20 text-white/40"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </button>
                <span className="text-sm text-white/30 line-through">{item.text}</span>
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                className="p-1 text-white/15 transition-colors hover:text-white/40"
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
        <div className="rounded-lg border border-white/[0.08] bg-white/20 p-6 text-center">
          <p className="text-sm text-white/30">No action items yet. Add one above.</p>
        </div>
      )}
    </div>
  );
}
