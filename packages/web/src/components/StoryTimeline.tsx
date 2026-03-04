"use client";

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoryTransition {
  timestamp: string;
  fromStatus: string;
  toStatus: string;
  dwellMs: number | null;
}

interface StoryDetailData {
  storyId: string;
  currentStatus: string;
  epic: string | null;
  transitions: StoryTransition[];
  columnDwells: Array<{ column: string; totalDwellMs: number }>;
  totalCycleTimeMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  isCompleted: boolean;
}

// ---------------------------------------------------------------------------
// Status colors — matches SprintBoard COLUMN_COLORS pattern
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  backlog: {
    border: "border-zinc-700",
    bg: "bg-zinc-800",
    text: "text-zinc-400",
  },
  "ready-for-dev": {
    border: "border-yellow-700",
    bg: "bg-yellow-900/30",
    text: "text-yellow-400",
  },
  "in-progress": {
    border: "border-blue-700",
    bg: "bg-blue-900/30",
    text: "text-blue-400",
  },
  review: {
    border: "border-purple-700",
    bg: "bg-purple-900/30",
    text: "text-purple-400",
  },
  done: {
    border: "border-green-700",
    bg: "bg-green-900/30",
    text: "text-green-400",
  },
};

const DEFAULT_STATUS_COLOR = {
  border: "border-zinc-600",
  bg: "bg-zinc-800",
  text: "text-zinc-400",
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? DEFAULT_STATUS_COLOR;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StoryTimeline({ projectId, storyId }: { projectId: string; storyId: string }) {
  const [data, setData] = useState<StoryDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let initialLoad = true;

    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/story/${encodeURIComponent(storyId)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load story data");
          return res.json();
        })
        .then((d) => {
          if (!cancelled) {
            setData(d as StoryDetailData);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
        })
        .finally(() => {
          if (!cancelled && initialLoad) {
            setLoading(false);
            initialLoad = false;
          }
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId, storyId]);

  // Loading state
  if (loading) {
    return (
      <div className="text-[var(--color-text-muted)] text-sm p-4">Loading story detail...</div>
    );
  }

  // Error state
  if (error) {
    return <div className="text-red-400 text-sm p-4">{error}</div>;
  }

  // Empty state
  if (!data) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <p className="text-xs text-[var(--color-text-muted)]">No story data available.</p>
      </div>
    );
  }

  const statusColor = getStatusColor(data.currentStatus);
  const maxDwell =
    data.columnDwells.length > 0 ? Math.max(...data.columnDwells.map((d) => d.totalDwellMs), 1) : 1;

  return (
    <div className="space-y-4">
      {/* Header with status badge */}
      <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            Story: {data.storyId}
          </h2>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border ${statusColor.border} ${statusColor.bg} ${statusColor.text}`}
          >
            {data.currentStatus}
          </span>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-[11px] text-[var(--color-text-muted)]">
          {data.epic && <span>Epic: {data.epic}</span>}
          {data.isCompleted && data.totalCycleTimeMs !== null && (
            <span>Cycle time: {formatDuration(data.totalCycleTimeMs)}</span>
          )}
          {data.startedAt && <span>Started: {formatTimestamp(data.startedAt)}</span>}
          {data.completedAt && <span>Completed: {formatTimestamp(data.completedAt)}</span>}
        </div>
      </div>

      {/* Vertical timeline */}
      {data.transitions.length > 0 ? (
        <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">Timeline</h3>
          <div className="relative ml-3">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--color-border-default)]" />

            {data.transitions.map((t, i) => {
              const toColor = getStatusColor(t.toStatus);

              return (
                <div key={i} className="relative pl-6 pb-4 last:pb-0">
                  {/* Dot */}
                  <div
                    className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 ${toColor.border} ${toColor.bg}`}
                  />

                  {/* Content */}
                  <div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                      {formatTimestamp(t.timestamp)}
                      {t.dwellMs !== null && (
                        <span className="ml-2 text-[var(--color-text-muted)]">
                          after {formatDuration(t.dwellMs)}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[var(--color-text-primary)]">
                      <span className={getStatusColor(t.fromStatus).text}>{t.fromStatus}</span>
                      <span className="text-[var(--color-text-muted)] mx-1.5">&rarr;</span>
                      <span className={toColor.text}>{t.toStatus}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <p className="text-xs text-[var(--color-text-muted)]">No transitions recorded yet.</p>
        </div>
      )}

      {/* Column dwell summary */}
      {data.columnDwells.length > 0 && (
        <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Column Dwell Times
          </h3>
          <div className="space-y-2">
            {data.columnDwells.map((dwell) => {
              const pct = Math.round((dwell.totalDwellMs / maxDwell) * 100);
              const dwellColor = getStatusColor(dwell.column);

              return (
                <div key={dwell.column} className="flex items-center gap-3">
                  <span className={`text-[11px] w-28 text-right ${dwellColor.text}`}>
                    {dwell.column}
                  </span>
                  <div className="flex-1 h-4 bg-[var(--color-bg-inset)] rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${dwellColor.bg} border ${dwellColor.border}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] w-16">
                    {formatDuration(dwell.totalDwellMs)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
