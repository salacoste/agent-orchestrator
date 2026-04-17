"use client";

import type { ProjectMemoryEntry } from "@composio/ao-core";
import { useProjectMemorySSE } from "@/hooks/useProjectMemorySSE";
import { ActivityDot } from "./ActivityDot";
import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectMemoryViewerProps {
  sessionId: string;
}

type EntryType = ProjectMemoryEntry["type"];

const ENTRY_GROUPS: { type: EntryType; label: string }[] = [
  { type: "convention", label: "Conventions" },
  { type: "decision", label: "Decisions" },
  { type: "directive", label: "Directives" },
  { type: "learning", label: "Learnings" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: ProjectMemoryEntry;
  onEdit: (entry: ProjectMemoryEntry) => void;
  onDelete: (entry: ProjectMemoryEntry) => void;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-[4px] px-2 py-1.5 hover:bg-[var(--color-bg-subtle)]">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--color-text-secondary)]">{entry.content}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {typeof entry.source === "string" && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{entry.source}</span>
          )}
          {typeof entry.timestamp === "string" && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {new Date(entry.timestamp).toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
        <button
          onClick={() => onEdit(entry)}
          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-secondary)]"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(entry)}
          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-status-error)] hover:bg-[var(--color-bg-muted)]"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EditEntryForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: ProjectMemoryEntry;
  onSave: (updated: ProjectMemoryEntry) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(entry.content);

  return (
    <div className="rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded border border-[var(--color-border-default)] bg-[var(--color-bg-default)] p-1.5 text-[11px] text-[var(--color-text-secondary)]"
        rows={3}
      />
      <div className="mt-1.5 flex gap-1.5">
        <button
          onClick={() => onSave({ ...entry, content, timestamp: new Date().toISOString() })}
          className="rounded bg-[var(--color-bg-accent)] px-2 py-0.5 text-[10px] font-medium text-white"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-[var(--color-border-default)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeleteConfirm({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: ProjectMemoryEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[4px] border border-[var(--color-status-error)] bg-[var(--color-bg-subtle)] px-2 py-1.5">
      <span className="text-[10px] text-[var(--color-text-tertiary)]">
        Delete &quot;{entry.content.slice(0, 40)}
        {entry.content.length > 40 ? "..." : ""}&quot;?
      </span>
      <button
        onClick={onConfirm}
        className="rounded bg-[var(--color-status-error)] px-2 py-0.5 text-[10px] font-medium text-white"
      >
        Delete
      </button>
      <button
        onClick={onCancel}
        className="rounded border border-[var(--color-border-default)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)]"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectMemoryViewer({ sessionId }: ProjectMemoryViewerProps) {
  const { memory, exists, connected } = useProjectMemorySSE(sessionId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const persistEntries = useCallback(
    async (entries: ProjectMemoryEntry[]) => {
      setSaving(true);
      try {
        await fetch(`/api/session/${sessionId}/memory`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });
      } finally {
        setSaving(false);
      }
    },
    [sessionId],
  );

  const handleSave = useCallback(
    async (updated: ProjectMemoryEntry) => {
      if (!memory) return;
      const entries = memory.entries.map((e) => (e.id === updated.id ? updated : e));
      await persistEntries(entries);
      setEditingId(null);
    },
    [memory, persistEntries],
  );

  const handleDelete = useCallback(
    async (entry: ProjectMemoryEntry) => {
      if (!memory) return;
      const entries = memory.entries.filter((e) => e.id !== entry.id);
      await persistEntries(entries);
      setDeletingId(null);
    },
    [memory, persistEntries],
  );

  // --- Rendering ---

  if (!exists) {
    return (
      <div
        className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
        data-testid="project-memory-panel"
        role="region"
        aria-labelledby="project-memory-heading"
      >
        <p className="text-[11px] text-[var(--color-text-tertiary)]">No project memory available</p>
      </div>
    );
  }

  if (!memory) {
    return (
      <div
        className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
        data-testid="project-memory-panel"
        role="region"
        aria-labelledby="project-memory-heading"
      >
        <p className="text-[11px] text-[var(--color-text-tertiary)]">Loading...</p>
      </div>
    );
  }

  const entries = memory.entries;

  return (
    <div
      className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
      data-testid="project-memory-panel"
      role="region"
      aria-labelledby="project-memory-heading"
    >
      <div className="mb-3 flex items-center gap-2">
        <ActivityDot activity={connected ? "active" : "idle"} dotOnly size={6} />
        <h3
          id="project-memory-heading"
          className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
        >
          Project Memory
        </h3>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
        {saving && <span className="text-[10px] text-[var(--color-text-tertiary)]">Saving...</span>}
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          No project memory entries yet
        </p>
      ) : (
        <div className="space-y-3">
          {ENTRY_GROUPS.map(({ type, label }) => {
            const groupEntries = entries.filter((e) => e.type === type);
            if (groupEntries.length === 0) return null;
            return (
              <div key={type}>
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  {label}
                </h4>
                <div className="space-y-0.5">
                  {groupEntries.map((entry) => {
                    if (editingId === entry.id) {
                      return (
                        <EditEntryForm
                          key={entry.id}
                          entry={entry}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                        />
                      );
                    }
                    if (deletingId === entry.id) {
                      return (
                        <DeleteConfirm
                          key={entry.id}
                          entry={entry}
                          onConfirm={() => handleDelete(entry)}
                          onCancel={() => setDeletingId(null)}
                        />
                      );
                    }
                    return (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        onEdit={(e) => setEditingId(e.id)}
                        onDelete={(e) => setDeletingId(e.id)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
