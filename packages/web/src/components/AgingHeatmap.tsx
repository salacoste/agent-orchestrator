"use client";

import { useState, useEffect } from "react";

interface AgingStory {
  storyId: string;
  column: string;
  ageMs: number;
  lastTransition: string;
  isAging: boolean;
}

interface ColumnAgingStats {
  column: string;
  stories: AgingStory[];
  p50Ms: number;
  p90Ms: number;
}

interface AgingData {
  columns: Record<string, ColumnAgingStats>;
  agingStories: AgingStory[];
  totalActive: number;
}

function formatAge(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(0)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function ageColor(ageMs: number, p90Ms: number): string {
  if (p90Ms <= 0) return "bg-green-950/50";
  const ratio = ageMs / p90Ms;
  if (ratio > 1) return "bg-red-900/70 border-red-600";
  if (ratio > 0.75) return "bg-yellow-900/50";
  if (ratio > 0.5) return "bg-yellow-950/30";
  return "bg-green-950/50";
}

export function AgingHeatmap({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<AgingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `?epic=${encodeURIComponent(epicFilter)}` : "";
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/aging${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load aging data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as AgingData);
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
    return <div className="text-[var(--color-text-muted)] text-[11px]">Loading aging data...</div>;
  }
  if (data.totalActive === 0) {
    return <div className="text-[var(--color-text-muted)] text-[11px]">No active stories.</div>;
  }

  const columnEntries = Object.entries(data.columns);

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[var(--color-text-muted)]">
        {data.totalActive} active stories &middot;{" "}
        {data.agingStories.length > 0 ? (
          <span className="text-red-400">{data.agingStories.length} aging (&gt;P90)</span>
        ) : (
          <span className="text-green-400">No aging stories</span>
        )}
      </div>

      {columnEntries.map(([column, stats]) => (
        <div key={column}>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.10em] text-[var(--color-text-tertiary)]">
              {column}
            </h4>
            <span className="text-[9px] text-[var(--color-text-muted)]">
              P50: {formatAge(stats.p50Ms)} &middot; P90: {formatAge(stats.p90Ms)}
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
            {stats.stories
              .sort((a, b) => b.ageMs - a.ageMs)
              .map((story) => (
                <div
                  key={story.storyId}
                  className={`rounded px-1.5 py-1 text-[10px] border border-transparent ${ageColor(story.ageMs, stats.p90Ms)} ${story.isAging ? "border-red-600" : ""}`}
                  title={`${story.storyId}: ${formatAge(story.ageMs)} in ${story.column}`}
                >
                  <div className="font-mono text-[var(--color-text-muted)] truncate">
                    {story.storyId}
                  </div>
                  <div
                    className={`text-[9px] ${story.isAging ? "text-red-400 font-semibold" : "text-[var(--color-text-muted)]"}`}
                  >
                    {formatAge(story.ageMs)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
