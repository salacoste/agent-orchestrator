"use client";

import { useState, useEffect } from "react";

interface StoryRef {
  storyId: string;
  column: string;
  points?: number;
}

interface TeamMember {
  sessionId: string;
  storiesByColumn: Record<string, string[]>;
  totalInFlight: number;
  totalPoints: number;
  isOverloaded: boolean;
}

interface WorkloadData {
  members: TeamMember[];
  overloaded: string[];
  unassigned: StoryRef[];
  overloadThreshold: number;
}

const COLUMN_COLORS: Record<string, string> = {
  backlog: "bg-zinc-800",
  "ready-for-dev": "bg-yellow-900/50",
  "in-progress": "bg-blue-900/50",
  review: "bg-purple-900/50",
};

export function TeamWorkloadView({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<WorkloadData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `?epic=${encodeURIComponent(epicFilter)}` : "";
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/workload${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load workload data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as WorkloadData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, epicFilter]);

  if (error) return <div className="text-red-400 text-[11px]">{error}</div>;
  if (!data) {
    return (
      <div className="text-[var(--color-text-muted)] text-[11px]">Loading workload data...</div>
    );
  }
  if (data.members.length === 0 && data.unassigned.length === 0) {
    return <div className="text-[var(--color-text-muted)] text-[11px]">No active assignments.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[var(--color-text-muted)]">
        Overload limit: {data.overloadThreshold} in-flight stories
        {data.overloaded.length > 0 && (
          <span className="text-red-400 ml-2">{data.overloaded.length} overloaded</span>
        )}
      </div>

      {/* Member cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.members.map((member) => (
          <div
            key={member.sessionId}
            className={`rounded-[6px] border p-3 ${
              member.isOverloaded
                ? "border-red-700 bg-red-950/20"
                : "border-[var(--color-border-default)] bg-[var(--color-bg-base)]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <a
                href={`/sessions/${encodeURIComponent(member.sessionId)}`}
                className="text-[12px] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
              >
                {member.sessionId}
              </a>
              {member.isOverloaded && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900 text-red-300 font-semibold">
                  OVERLOADED
                </span>
              )}
            </div>

            <div className="flex gap-3 text-[10px] text-[var(--color-text-muted)] mb-2">
              <span>In-flight: {member.totalInFlight}</span>
              <span>Points: {member.totalPoints}</span>
            </div>

            {/* Column distribution */}
            <div className="space-y-1">
              {Object.entries(member.storiesByColumn).map(([col, storyIds]) => (
                <div key={col} className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded ${COLUMN_COLORS[col] ?? "bg-zinc-800"} text-[var(--color-text-muted)] w-20 text-center shrink-0`}
                  >
                    {col}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] truncate">
                    {storyIds.join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned */}
      {data.unassigned.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.10em] text-yellow-400 mb-2">
            Unassigned ({data.unassigned.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
            {data.unassigned.map((story) => (
              <div
                key={story.storyId}
                className="flex items-center gap-1.5 text-[10px] py-1 px-2 rounded bg-[var(--color-bg-inset)]"
              >
                <span className="font-mono text-[var(--color-text-muted)]">{story.storyId}</span>
                <span className="text-[9px] text-[var(--color-text-tertiary)]">{story.column}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
