"use client";

/**
 * CrossSessionMemoryViewer — dashboard panel for accumulated cross-session knowledge.
 *
 * Shows entries grouped by type with filtering, inline edit, and delete.
 * Story 61-2, AC #2, #3, #4, #5, #6.
 */
import { useState, useMemo } from "react";
import { useCrossSessionMemory } from "@/hooks/useCrossSessionMemory";
import type { CrossSessionMemoryEntry } from "@composio/ao-core";

type EntryType = CrossSessionMemoryEntry["type"];
const ENTRY_TYPES: EntryType[] = ["convention", "decision", "directive", "learning"];

const TYPE_COLORS: Record<EntryType, string> = {
  convention: "bg-blue-100 text-blue-800",
  decision: "bg-purple-100 text-purple-800",
  directive: "bg-orange-100 text-orange-800",
  learning: "bg-green-100 text-green-800",
};

interface Props {
  projectName: string;
}

export function CrossSessionMemoryViewer({ projectName }: Props) {
  const { entries, enabled, connected, error } = useCrossSessionMemory(projectName);

  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [sessionFilter, setSessionFilter] = useState("");
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState(false);

  const encodedProject = encodeURIComponent(projectName);

  const filtered = useMemo(() => {
    let result = entries;
    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter);
    }
    if (sessionFilter.trim()) {
      const q = sessionFilter.trim().toLowerCase();
      result = result.filter((e) => e.sourceSessionIds.some((s) => s.toLowerCase().includes(q)));
    }
    return result;
  }, [entries, typeFilter, sessionFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<EntryType, CrossSessionMemoryEntry[]>();
    for (const type of ENTRY_TYPES) {
      const items = filtered.filter((e) => e.type === type);
      if (items.length > 0) groups.set(type, items);
    }
    return groups;
  }, [filtered]);

  async function handleSave(contentHash: string) {
    if (!editContent.trim()) return;
    setSaving(true);
    setMutationError(false);
    try {
      const res = await fetch(`/api/cross-session-memory/${encodedProject}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash, content: editContent.trim() }),
      });
      if (!res.ok) {
        console.error("Failed to update entry");
        setMutationError(true);
      }
    } catch (err) {
      console.error("Failed to update entry:", err);
      setMutationError(true);
    } finally {
      setSaving(false);
      if (!mutationError) setEditingHash(null);
    }
  }

  async function handleDelete(contentHash: string) {
    setSaving(true);
    setMutationError(false);
    try {
      const res = await fetch(`/api/cross-session-memory/${encodedProject}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash }),
      });
      if (!res.ok) {
        console.error("Failed to delete entry");
        setMutationError(true);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
      setMutationError(true);
    } finally {
      setSaving(false);
      if (!mutationError) setDeleteTarget(null);
    }
  }

  function startEdit(entry: CrossSessionMemoryEntry) {
    setEditingHash(entry.contentHash);
    setEditContent(entry.content);
    setMutationError(false);
  }

  // Disabled state
  if (!enabled) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Cross-Session Knowledge</h3>
        <p className="text-sm text-gray-500">
          Enable cross-session memory in project config to view accumulated knowledge.
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Cross-Session Knowledge</h3>
        <p className="text-sm text-red-500">Failed to load cross-session memory.</p>
      </div>
    );
  }

  const totalCount = entries.length;

  return (
    <div className="border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">
          Cross-Session Knowledge
          <span className="ml-2 text-sm font-normal text-gray-500">
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
          </span>
          {saving && <span className="ml-2 text-sm text-blue-500">Saving...</span>}
        </h3>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="w-2 h-2 rounded-full bg-green-500" aria-label="SSE connected" />
          )}
        </div>
      </div>

      {/* Mutation error banner */}
      {mutationError && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Failed to save changes. The display will refresh automatically.
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 mb-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EntryType | "all")}
          className="text-sm border rounded px-2 py-1"
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          {ENTRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}s
            </option>
          ))}
        </select>
        <input
          type="text"
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          placeholder="Filter by session ID..."
          className="text-sm border rounded px-2 py-1 flex-1"
          aria-label="Filter by source session"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <p className="text-sm text-gray-500">
          {totalCount === 0
            ? "No cross-session memory entries yet"
            : "No entries match the current filters"}
        </p>
      )}

      {/* Grouped entries */}
      {Array.from(grouped.entries()).map(([type, items]) => (
        <div key={type} className="mb-3">
          <h4 className="text-sm font-medium text-gray-600 mb-1">
            {type.charAt(0).toUpperCase() + type.slice(1)}s
          </h4>
          <ul className="space-y-1">
            {items.map((entry) => (
              <li
                key={entry.contentHash}
                className="flex items-start gap-2 group p-1 rounded hover:bg-gray-50"
              >
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLORS[entry.type]}`}
                >
                  {entry.type}
                </span>
                <div className="flex-1 min-w-0">
                  {editingHash === entry.contentHash ? (
                    <div className="flex gap-1">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="text-sm border rounded px-1 py-0.5 flex-1 min-h-[2rem]"
                        aria-label="Edit entry content"
                      />
                      <button
                        onClick={() => handleSave(entry.contentHash)}
                        disabled={saving}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingHash(null)}
                        className="text-xs px-2 py-1 border rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm break-words">{entry.content}</p>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>from {entry.sourceSessionIds.length} session(s)</span>
                        {entry.lastSeenAt && (
                          <span>{new Date(entry.lastSeenAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {editingHash !== entry.contentHash && (
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(entry)}
                      className="text-xs px-1.5 py-0.5 text-blue-600 hover:underline"
                      aria-label={`Edit ${entry.type} entry`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(entry.contentHash)}
                      className="text-xs px-1.5 py-0.5 text-red-600 hover:underline"
                      aria-label={`Delete ${entry.type} entry`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 shadow-lg max-w-sm">
            <p className="text-sm mb-3">Delete this entry? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-sm px-3 py-1 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={saving}
                className="text-sm px-3 py-1 bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
