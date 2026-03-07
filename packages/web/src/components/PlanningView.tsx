"use client";

import { useState, useEffect } from "react";

interface PlannableStory {
  id: string;
  title: string;
  epic: string | null;
  isBlocked: boolean;
  blockers: string[];
  priority?: "critical" | "high" | "medium" | "low";
  score?: number;
  unblockCount?: number;
}

interface PlanningData {
  backlogStories: PlannableStory[];
  recommended: PlannableStory[];
  sprintConfig: {
    startDate: string | null;
    endDate: string | null;
    goal: string | null;
    targetVelocity: number | null;
  };
  capacity: {
    historicalVelocity: number;
    targetVelocity: number | null;
    effectiveTarget: number;
    inProgressCount: number;
    remainingCapacity: number;
  };
  loadStatus: "under" | "at-capacity" | "over" | "no-data";
}

const LOAD_COLORS: Record<string, string> = {
  under: "text-green-400",
  "at-capacity": "text-yellow-400",
  over: "text-red-400",
  "no-data": "text-[var(--color-text-muted)]",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-900 text-red-300",
  high: "bg-orange-900 text-orange-300",
  medium: "bg-yellow-900 text-yellow-300",
  low: "bg-zinc-800 text-zinc-400",
};

export function PlanningView({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<PlanningData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `?epic=${encodeURIComponent(epicFilter)}` : "";
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/plan${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load planning data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as PlanningData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, epicFilter]);

  if (error) {
    return <div className="text-red-400 text-[11px]">{error}</div>;
  }

  if (!data) {
    return (
      <div className="text-[var(--color-text-muted)] text-[11px]">Loading planning data...</div>
    );
  }

  const cap = data.capacity;
  const pct =
    cap.effectiveTarget > 0 ? Math.round((cap.inProgressCount / cap.effectiveTarget) * 100) : 0;
  const blocked = data.backlogStories.filter((s) => s.isBlocked);

  return (
    <div className="space-y-4">
      {/* Sprint config */}
      {data.sprintConfig.goal && (
        <div className="text-[12px]">
          <span className="text-[var(--color-text-muted)]">Goal: </span>
          <span className="text-[var(--color-text-primary)] font-medium">
            {data.sprintConfig.goal}
          </span>
        </div>
      )}

      {/* Capacity bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--color-text-muted)]">Capacity</span>
          <span className={LOAD_COLORS[data.loadStatus]}>
            {cap.inProgressCount} in-progress /{" "}
            {cap.effectiveTarget > 0 ? cap.effectiveTarget : "?"} target ({data.loadStatus})
          </span>
        </div>
        {cap.effectiveTarget > 0 && (
          <div className="w-full h-2 bg-[var(--color-bg-inset)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                data.loadStatus === "over"
                  ? "bg-red-500"
                  : data.loadStatus === "at-capacity"
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        )}
        <div className="flex gap-3 text-[10px] text-[var(--color-text-muted)]">
          {cap.targetVelocity !== null && <span>Target: {cap.targetVelocity}</span>}
          {cap.historicalVelocity > 0 && (
            <span>Historical: {cap.historicalVelocity.toFixed(1)}/week</span>
          )}
          <span>Remaining capacity: {cap.remainingCapacity}</span>
        </div>
      </div>

      {/* Recommended stories */}
      {data.recommended.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.10em] text-green-400 mb-2">
            Recommended ({data.recommended.length})
          </h4>
          <div className="space-y-1">
            {data.recommended.map((story) => (
              <div
                key={story.id}
                className="flex items-center gap-2 text-[11px] py-1 px-2 rounded bg-[var(--color-bg-inset)]"
              >
                <span className="font-mono text-[var(--color-text-muted)] w-16 shrink-0">
                  {story.id}
                </span>
                {story.priority && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${PRIORITY_COLORS[story.priority] ?? "bg-zinc-800 text-zinc-400"}`}
                  >
                    {story.priority}
                  </span>
                )}
                <span className="text-[var(--color-text-primary)] truncate">{story.title}</span>
                {story.score !== undefined && (
                  <span className="text-[9px] text-[var(--color-text-muted)] shrink-0">
                    score: {story.score}
                  </span>
                )}
                {(story.unblockCount ?? 0) > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-950 text-green-400 shrink-0">
                    unblocks {story.unblockCount}
                  </span>
                )}
                {story.epic && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] shrink-0">
                    {story.epic}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked stories */}
      {blocked.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.10em] text-red-400 mb-2">
            Blocked ({blocked.length})
          </h4>
          <div className="space-y-1">
            {blocked.map((story) => (
              <div
                key={story.id}
                className="flex items-center gap-2 text-[11px] py-1 px-2 rounded bg-[var(--color-bg-inset)] opacity-70"
              >
                <span className="font-mono text-[var(--color-text-muted)] w-16 shrink-0">
                  {story.id}
                </span>
                <span className="text-red-400 text-[10px]">
                  ⊘ blocked by {story.blockers.join(", ")}
                </span>
                {story.epic && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] shrink-0">
                    {story.epic}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.backlogStories.length === 0 && (
        <div className="text-[var(--color-text-muted)] text-[11px]">No stories in backlog.</div>
      )}
    </div>
  );
}
