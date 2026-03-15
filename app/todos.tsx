"use client";

import { useEffect, useState, useCallback } from "react";

interface Todo {
  id: string;
  text: string;
  done: boolean;
  suggested: boolean;
  dismissed: boolean;
}

interface CalendarEvent {
  title: string;
  time: string;
  location: string | null;
  attendees: number;
}

function generateSuggestions(events: CalendarEvent[]): Todo[] {
  const suggestions: Todo[] = [];

  for (const event of events) {
    const title = event.title;

    // Weekly syncs, standups, check-ins
    if (/sync|standup|check.?in|1.?on.?1|one.?on.?one|weekly|recurring/i.test(title)) {
      suggestions.push({
        id: `sug-agenda-${title}`,
        text: `Organize agenda for ${title}`,
        done: false,
        suggested: true,
        dismissed: false,
      });
    }

    // Demos, presentations
    if (/demo|presentation|pitch|showcase/i.test(title)) {
      suggestions.push({
        id: `sug-prep-${title}`,
        text: `Prepare materials for ${title}`,
        done: false,
        suggested: true,
        dismissed: false,
      });
    }

    // Reviews
    if (/review|retro|debrief|postmortem/i.test(title)) {
      suggestions.push({
        id: `sug-notes-${title}`,
        text: `Compile notes ahead of ${title}`,
        done: false,
        suggested: true,
        dismissed: false,
      });
    }

    // Customer or external meetings
    if (/customer|client|partner|external|vendor/i.test(title) || event.attendees > 3) {
      suggestions.push({
        id: `sug-brief-${title}`,
        text: `Brief team before ${title}`,
        done: false,
        suggested: true,
        dismissed: false,
      });
    }

    // Interviews
    if (/interview|screening|candidate/i.test(title)) {
      suggestions.push({
        id: `sug-review-${title}`,
        text: `Review candidate profile for ${title}`,
        done: false,
        suggested: true,
        dismissed: false,
      });
    }

    // Planning, strategy
    if (/planning|strategy|roadmap|kickoff/i.test(title)) {
      suggestions.push({
        id: `sug-prep-${title}`,
        text: `Draft talking points for ${title}`,
        done: false,
        suggested: true,
        dismissed: false,
      });
    }

    // Generic meetings with multiple attendees
    if (
      event.attendees >= 2 &&
      !suggestions.some((s) => s.id.includes(title))
    ) {
      suggestions.push({
        id: `sug-generic-${title}`,
        text: `Prepare for ${title}`,
        done: false,
        suggested: true,
        dismissed: false,
      });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

const STORAGE_KEY = "gc-todos";

function loadTodos(): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTodos(todos: Todo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

export default function Todos({ events }: { events: CalendarEvent[] }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    setTodos(loadTodos());
    setLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (loaded) saveTodos(todos);
  }, [todos, loaded]);

  // Generate suggestions from calendar
  const suggestions = generateSuggestions(events);
  const dismissedIds = new Set(
    todos.filter((t) => t.dismissed).map((t) => t.id)
  );
  const acceptedIds = new Set(
    todos.filter((t) => t.suggested && !t.dismissed).map((t) => t.id)
  );
  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(s.id) && !acceptedIds.has(s.id)
  );

  const manualTodos = todos.filter((t) => !t.dismissed && (!t.suggested || acceptedIds.has(t.id)));

  const addTodo = useCallback(() => {
    if (!newTodo.trim()) return;
    setTodos((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        text: newTodo.trim(),
        done: false,
        suggested: false,
        dismissed: false,
      },
    ]);
    setNewTodo("");
  }, [newTodo]);

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const acceptSuggestion = (suggestion: Todo) => {
    setTodos((prev) => [...prev, { ...suggestion }]);
  };

  const dismissSuggestion = (id: string) => {
    setTodos((prev) => [
      ...prev,
      { id, text: "", done: false, suggested: true, dismissed: true },
    ]);
  };

  const activeTodos = manualTodos.filter((t) => !t.done);
  const completedTodos = manualTodos.filter((t) => t.done);

  return (
    <div className="flex flex-col gap-6">
      {/* Add todo input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTodo();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a to-do..."
          className="flex-1 border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 backdrop-blur-sm outline-none transition-colors focus:border-white/25"
        />
        <button
          type="submit"
          className="border border-white/10 bg-white/5 px-4 py-2.5 text-xs tracking-widest text-white/70 uppercase backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10"
        >
          Add
        </button>
      </form>

      {/* Suggested todos from calendar */}
      {visibleSuggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-widest text-white/30 uppercase">
            Suggested from your calendar
          </p>
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex items-center justify-between border border-white/[0.07] bg-white/[0.03] px-4 py-3 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="h-3.5 w-3.5 text-white/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                  />
                </svg>
                <span className="text-sm text-white/50">{suggestion.text}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => acceptSuggestion(suggestion)}
                  className="p-1.5 text-white/30 transition-colors hover:text-white/70"
                  title="Accept"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </button>
                <button
                  onClick={() => dismissSuggestion(suggestion.id)}
                  className="p-1.5 text-white/30 transition-colors hover:text-white/70"
                  title="Dismiss"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active todos */}
      {activeTodos.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeTodos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center justify-between border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-all hover:border-white/20"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="h-4 w-4 border border-white/30 transition-colors hover:border-white/60"
                />
                <span className="text-sm text-white">{todo.text}</span>
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
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

      {/* Completed todos */}
      {completedTodos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-widest text-white/20 uppercase">
            Completed
          </p>
          {completedTodos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center justify-between border border-white/[0.05] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="flex h-4 w-4 items-center justify-center border border-white/20 text-white/40"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </button>
                <span className="text-sm text-white/30 line-through">
                  {todo.text}
                </span>
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
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
      {activeTodos.length === 0 && completedTodos.length === 0 && visibleSuggestions.length === 0 && (
        <div className="border border-white/[0.05] bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-white/30">No to-dos yet. Add one above.</p>
        </div>
      )}
    </div>
  );
}
