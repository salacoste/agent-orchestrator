"use client";

import { useState, useEffect } from "react";

interface StoryDetail {
  id: string;
  title: string;
  status: string;
  epic: string | null;
  points: number | null;
  transitions: Array<{
    timestamp: string;
    fromStatus: string;
    toStatus: string;
  }>;
  columnDwells: Array<{
    column: string;
    dwellMs: number;
  }>;
  cycleTimeMs: number | null;
}

function formatDuration(ms: number): string {
  if (ms < 0) return "0m";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    return remainingHours > 0 ? `${totalDays}d ${remainingHours}h` : `${totalDays}d`;
  }
  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`;
  }
  return `${totalMinutes}m`;
}

function formatTimestamp(ts: string): string {
  return ts.replace("T", " ").replace(/\.\d{3}Z$/, "");
}

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-zinc-700",
  "ready-for-dev": "bg-yellow-700",
  "in-progress": "bg-blue-700",
  review: "bg-purple-700",
  done: "bg-green-700",
};

export function StoryDetailModal({
  projectId,
  storyId,
  onClose,
}: {
  projectId: string;
  storyId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/story/${encodeURIComponent(storyId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load story details");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d as StoryDetail);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, storyId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            Story Detail: {storyId}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && <div className="text-[var(--color-text-muted)] text-sm">Loading...</div>}
          {error && <div className="text-red-400 text-sm">{error}</div>}

          {data && (
            <>
              {/* Story info */}
              <div className="space-y-2">
                <div className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  {data.title}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded text-white ${STATUS_COLORS[data.status] ?? "bg-zinc-700"}`}
                  >
                    {data.status}
                  </span>
                  {data.epic && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]">
                      {data.epic}
                    </span>
                  )}
                  {data.points !== null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/50 text-blue-400 font-mono">
                      {data.points}pt
                    </span>
                  )}
                  {data.cycleTimeMs !== null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]">
                      Cycle: {formatDuration(data.cycleTimeMs)}
                    </span>
                  )}
                </div>
              </div>

              {/* Column dwell bars */}
              {data.columnDwells.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-[var(--color-text-secondary)] mb-2">
                    Column Dwell Time
                  </h3>
                  <div className="space-y-1.5">
                    {data.columnDwells.map((dwell) => {
                      const maxDwell = Math.max(...data.columnDwells.map((d) => d.dwellMs), 1);
                      const pct = (dwell.dwellMs / maxDwell) * 100;
                      return (
                        <div key={dwell.column} className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--color-text-muted)] w-24 text-right">
                            {dwell.column}
                          </span>
                          <div className="flex-1 h-2 bg-[var(--color-bg-inset)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-accent)] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[var(--color-text-muted)] w-16">
                            {formatDuration(dwell.dwellMs)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {data.transitions.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-[var(--color-text-secondary)] mb-2">
                    Timeline
                  </h3>
                  <div className="space-y-1">
                    {data.transitions.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="text-[var(--color-text-muted)] w-36 font-mono text-[10px]">
                          {formatTimestamp(t.timestamp)}
                        </span>
                        <span className="text-[var(--color-text-muted)]">{t.fromStatus}</span>
                        <span className="text-[var(--color-text-muted)]">&rarr;</span>
                        <span className="text-[var(--color-text-primary)] font-medium">
                          {t.toStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
