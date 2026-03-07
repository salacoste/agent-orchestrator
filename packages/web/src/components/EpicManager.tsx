"use client";

import { useState, useEffect, useCallback } from "react";

interface EpicInfo {
  id: string;
  title: string;
  storyCount: number;
  doneCount: number;
  progress: number;
}

export function EpicManager({ projectId }: { projectId: string }) {
  const [epics, setEpics] = useState<EpicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchEpics = useCallback(() => {
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/epics`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load epics");
        return res.json();
      })
      .then((d) => {
        setEpics(d as EpicInfo[]);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchEpics();
  }, [fetchEpics]);

  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/sprint/${encodeURIComponent(projectId)}/epics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDesc.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setCreateTitle("");
      setCreateDesc("");
      fetchEpics();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleRename = async (epicId: string) => {
    if (!renameTitle.trim()) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/sprint/${encodeURIComponent(projectId)}/epics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epicId, title: renameTitle.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setRenameTarget(null);
      setRenameTitle("");
      fetchEpics();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleDelete = async (epicId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/sprint/${encodeURIComponent(projectId)}/epics`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epicId }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      fetchEpics();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (loading)
    return <div className="text-[var(--color-text-muted)] text-sm p-2">Loading epics...</div>;
  if (error) return <div className="text-red-400 text-sm p-2">{error}</div>;

  return (
    <div className="space-y-3">
      {actionError && (
        <div className="rounded-[5px] border border-red-700 bg-red-950/30 px-3 py-2 text-[11px] text-red-400">
          {actionError}
        </div>
      )}

      {/* Epic list */}
      {epics.length > 0 && (
        <div className="space-y-2">
          {epics.map((epic) => (
            <div
              key={epic.id}
              className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    {epic.id}
                  </span>
                  {renameTarget === epic.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(epic.id);
                          if (e.key === "Escape") setRenameTarget(null);
                        }}
                        className="text-[12px] px-1.5 py-0.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] w-40"
                        autoFocus
                      />
                      <button
                        onClick={() => void handleRename(epic.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white hover:opacity-80"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setRenameTarget(null)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-inset)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-[12px] font-medium text-[var(--color-text-primary)]">
                      {epic.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setRenameTarget(epic.id);
                      setRenameTitle(epic.title);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => void handleDelete(epic.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-inset)] text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[var(--color-bg-inset)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-status-success)] rounded-full transition-all"
                    style={{ width: `${epic.progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
                  {epic.doneCount}/{epic.storyCount} ({epic.progress}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {epics.length === 0 && (
        <div className="text-[11px] text-[var(--color-text-muted)] text-center py-2">
          No epics found. Create one below.
        </div>
      )}

      {/* Create form */}
      <div className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-3 space-y-2">
        <div className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
          Create Epic
        </div>
        <input
          type="text"
          placeholder="Epic title"
          value={createTitle}
          onChange={(e) => setCreateTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
          className="w-full text-[12px] px-2.5 py-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
        />
        <textarea
          placeholder="Description (optional)"
          value={createDesc}
          onChange={(e) => setCreateDesc(e.target.value)}
          rows={2}
          className="w-full text-[12px] px-2.5 py-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
        />
        <button
          onClick={() => void handleCreate()}
          disabled={!createTitle.trim()}
          className="text-[11px] px-3 py-1.5 rounded bg-[var(--color-accent)] text-white hover:opacity-80 disabled:opacity-40"
        >
          Create Epic
        </button>
      </div>
    </div>
  );
}
