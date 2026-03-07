"use client";

import { useState, useEffect } from "react";

interface SummaryData {
  projectName: string;
  progress: number;
  stats: { total: number; done: number; inProgress: number; open: number };
  pointsStats?: { total: number; done: number; inProgress: number; open: number };
  healthOverall: string;
  healthIndicators: number;
  velocity: number;
  velocityTrend: string;
  forecastPace: string;
  daysRemaining: number | null;
  stuckStories: string[];
  wipAlerts: string[];
  sprintGoal: string | null;
  sprintNumber: number | null;
}

export function SprintSummaryCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      try {
        const res = await fetch(`/api/sprint/${encodeURIComponent(projectId)}/summary`);
        if (!res.ok) return;
        const json = (await res.json()) as SummaryData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load summary");
      }
    }

    void fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error || !data) return null;

  const healthColor =
    data.healthOverall === "critical"
      ? "text-red-400"
      : data.healthOverall === "warning"
        ? "text-yellow-400"
        : "text-green-400";

  const alertCount = data.stuckStories.length + data.wipAlerts.length;

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {data.sprintNumber ? `Sprint #${data.sprintNumber}` : "Sprint"} Summary
        </h3>
        {data.sprintGoal && (
          <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[300px]">
            {data.sprintGoal}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
          <span>Progress</span>
          <span>{data.progress}%</span>
        </div>
        <div className="h-2 bg-[var(--color-bg-inset)] rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${data.progress}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-3 text-center text-xs">
        <div>
          <div className="text-[var(--color-text-muted)]">Total</div>
          <div className="text-base font-bold text-[var(--color-text-primary)]">
            {data.stats.total}
          </div>
        </div>
        <div>
          <div className="text-[var(--color-text-muted)]">Done</div>
          <div className="text-base font-bold text-green-400">{data.stats.done}</div>
        </div>
        <div>
          <div className="text-[var(--color-text-muted)]">Active</div>
          <div className="text-base font-bold text-blue-400">{data.stats.inProgress}</div>
        </div>
        <div>
          <div className={`text-[var(--color-text-muted)]`}>Health</div>
          <div className={`text-base font-bold ${healthColor}`}>
            {data.healthOverall.toUpperCase()}
          </div>
        </div>
        <div>
          <div className="text-[var(--color-text-muted)]">
            {data.daysRemaining !== null ? "Days Left" : "Pace"}
          </div>
          <div className="text-base font-bold text-[var(--color-text-primary)]">
            {data.daysRemaining !== null ? data.daysRemaining : data.forecastPace}
          </div>
        </div>
      </div>

      {/* Velocity + alerts row */}
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>
          Velocity: {data.velocity} stories/sprint ({data.velocityTrend})
        </span>
        {alertCount > 0 && (
          <span className="text-yellow-400">
            {alertCount} alert{alertCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
