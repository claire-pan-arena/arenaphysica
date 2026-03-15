"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface KBNote {
  id: string;
  title: string;
  content: string;
  creatorEmail: string;
  creatorName: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgeBasePage() {
  const [notes, setNotes] = useState<KBNote[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newNote, setNewNote] = useState({ title: "", content: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ title: "", content: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchNotes = () => {
    fetch("/api/kb")
      .then((r) => r.json())
      .then((data) => {
        setNotes(data.notes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/tools")
      .then((r) => r.json())
      .then((data) => setCurrentUserEmail(data.currentUserEmail || ""))
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const createNote = async () => {
    if (!newNote.title.trim()) return;
    await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newNote),
    });
    setNewNote({ title: "", content: "" });
    setShowCreate(false);
    fetchNotes();
  };

  const saveEdit = async () => {
    if (!editingId || !editData.title.trim()) return;
    await fetch("/api/kb", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editData }),
    });
    setEditingId(null);
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await fetch("/api/kb", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const startEdit = (note: KBNote) => {
    setEditingId(note.id);
    setEditData({ title: note.title, content: note.content });
    setExpandedId(note.id);
  };

  const filtered = search
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />
      <div className="fixed inset-0 bg-black/30" />
      <div
        className="fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 80%, rgba(180,160,130,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Wireframe */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          viewBox="0 0 400 400"
          className="h-[800px] w-[800px] animate-[spin_30s_linear_infinite] opacity-[0.05]"
        >
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <header className="flex items-center justify-between px-8 py-4">
          <Link href="/" className="text-xs tracking-[0.3em] text-[#c5b9a8] uppercase font-medium hover:text-[#e8e5e0] transition-colors">
            Arena Physica
          </Link>
          <Link
            href="/"
            className="text-xs tracking-widest text-[#9a9da6] uppercase hover:text-[#e8e5e0] transition-colors"
          >
            Back to Dashboard
          </Link>
        </header>

        <div className="px-8 py-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2
                className="text-3xl text-[#e8e5e0]"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                Knowledge Base
              </h2>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="rounded-lg border border-[#8a9a5b]/20 bg-[#2d3a2e]/70 px-5 py-2.5 text-xs tracking-widest text-[#c5b9a8] uppercase backdrop-blur-xl transition-all hover:border-[#8a9a5b]/40 hover:bg-[#2d3a2e]/85"
            >
              {showCreate ? "Cancel" : "+ New Note"}
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="mb-8 rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-[#a09570] uppercase">
                Create a new note
              </h3>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  placeholder="Note title"
                  value={newNote.title}
                  onChange={(e) => setNewNote((p) => ({ ...p, title: e.target.value }))}
                  className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 backdrop-blur-xl outline-none focus:border-[#8a9a5b]/35"
                />
                <textarea
                  placeholder="Write your note here..."
                  value={newNote.content}
                  onChange={(e) => setNewNote((p) => ({ ...p, content: e.target.value }))}
                  rows={8}
                  className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 backdrop-blur-xl outline-none focus:border-[#8a9a5b]/35 resize-none leading-relaxed"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="rounded-lg border border-[#9a9da6]/15 bg-[#2d3a2e]/60 px-5 py-2.5 text-xs tracking-widest text-[#9a9da6] uppercase transition-all hover:bg-[#2d3a2e]/80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createNote}
                    className="rounded-lg border border-[#8a9a5b]/30 bg-[#8a9a5b]/20 px-5 py-2.5 text-xs tracking-widest text-[#c5b9a8] uppercase backdrop-blur-xl transition-all hover:bg-[#8a9a5b]/30"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 px-4 py-2.5 text-sm text-[#e8e5e0] placeholder-[#9a9da6]/50 backdrop-blur-xl outline-none focus:border-[#8a9a5b]/35"
            />
          </div>

          {/* Notes list */}
          {loading ? (
            <div className="flex flex-col gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/60 p-5 backdrop-blur-xl animate-pulse">
                  <div className="h-5 w-48 rounded bg-[#8a9a5b]/10 mb-3" />
                  <div className="h-3 w-full rounded bg-[#8a9a5b]/5 mb-2" />
                  <div className="h-3 w-2/3 rounded bg-[#8a9a5b]/5" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-[#8a9a5b]/10 bg-[#2d3a2e]/50 p-6 text-center">
              <p className="text-sm text-[#9a9da6]">
                {search ? "No notes match your search." : "No notes yet. Create one to get started."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map((note) => {
                const isExpanded = expandedId === note.id;
                const isEditing = editingId === note.id;

                return (
                  <div
                    key={note.id}
                    className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/70 p-5 backdrop-blur-xl transition-all hover:border-[#8a9a5b]/35"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-4">
                        <input
                          type="text"
                          value={editData.title}
                          onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))}
                          className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] outline-none focus:border-[#8a9a5b]/35"
                        />
                        <textarea
                          value={editData.content}
                          onChange={(e) => setEditData((p) => ({ ...p, content: e.target.value }))}
                          rows={8}
                          className="rounded-lg border border-[#8a9a5b]/15 bg-[#2d3a2e]/60 px-4 py-2.5 text-sm text-[#e8e5e0] outline-none focus:border-[#8a9a5b]/35 resize-none leading-relaxed"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-[#9a9da6]/15 bg-[#2d3a2e]/60 px-4 py-2 text-xs tracking-widest text-[#9a9da6] uppercase transition-all hover:bg-[#2d3a2e]/80"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            className="rounded-lg border border-[#8a9a5b]/30 bg-[#8a9a5b]/20 px-4 py-2 text-xs tracking-widest text-[#c5b9a8] uppercase transition-all hover:bg-[#8a9a5b]/30"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : note.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-[14px] font-medium text-[#e8e5e0]">
                              {note.title}
                            </h3>
                            <svg className={`h-4 w-4 text-[#9a9da6]/40 transition-transform shrink-0 ml-4 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                          {!isExpanded && note.content && (
                            <p className="text-xs leading-relaxed text-[#9a9da6] mb-3 line-clamp-2">
                              {note.content}
                            </p>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-3 mb-4">
                            <p className="text-sm leading-relaxed text-[#e8e5e0]/80 whitespace-pre-wrap">
                              {note.content || "No content yet."}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-[#9a9da6]/50">
                            by {note.creatorName}
                            {note.updatedByName && note.updatedByName !== note.creatorName && (
                              <> · edited by {note.updatedByName}</>
                            )}
                            {note.updatedAt && <> · {timeAgo(note.updatedAt)}</>}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(note)}
                              className="text-[#9a9da6]/30 hover:text-[#8a9a5b] transition-colors"
                              title="Edit note"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                            {note.creatorEmail === currentUserEmail && (
                              <button
                                onClick={() => deleteNote(note.id)}
                                className="text-[#9a9da6]/30 hover:text-[#e8e5e0] transition-colors"
                                title="Delete note"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
