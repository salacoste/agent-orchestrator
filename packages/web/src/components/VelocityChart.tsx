"use client";

import { useState, useEffect } from "react";

interface WeeklyVelocity {
  weekStart: string;
  weekEnd: string;
  completedCount: number;
  storyIds: string[];
}

interface VelocityData {
  weeks: WeeklyVelocity[];
  averageVelocity: number;
  stdDeviation: number;
  trend: "improving" | "stable" | "declining";
  trendSlope: number;
  trendConfidence: number;
  nextWeekEstimate: number;
  currentWeekSoFar: number;
  completionWeeks: number | null;
  remainingStories: number;
}

const TREND_COLORS: Record<string, string> = {
  improving: "text-green-400",
  stable: "text-yellow-400",
  declining: "text-red-400",
};

const TREND_ICONS: Record<string, string> = {
  improving: "↑",
  stable: "→",
  declining: "↓",
};

export function VelocityChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<VelocityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/velocity-comparison`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load velocity data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as VelocityData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) {
    return <div className="text-red-400 text-[11px]">{error}</div>;
  }

  if (!data) {
    return <div className="text-[var(--color-text-muted)] text-[11px]">Loading velocity...</div>;
  }

  if (data.weeks.length === 0) {
    return (
      <div className="text-[var(--color-text-muted)] text-[11px]">No completed stories yet.</div>
    );
  }

  const maxCount = Math.max(...data.weeks.map((w) => w.completedCount), 1);
  const chartHeight = 120;
  const barWidth = Math.min(40, Math.floor(300 / data.weeks.length));

  return (
    <div className="space-y-3">
      {/* SVG Bar Chart */}
      <div className="overflow-x-auto">
        <svg
          width={data.weeks.length * (barWidth + 4) + 20}
          height={chartHeight + 30}
          className="block"
        >
          {data.weeks.map((week, i) => {
            const barHeight = (week.completedCount / maxCount) * chartHeight;
            const x = i * (barWidth + 4) + 10;
            const y = chartHeight - barHeight;
            const label = week.weekStart.slice(5);
            return (
              <g key={week.weekStart}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  className={
                    data.trend === "improving"
                      ? "fill-green-600"
                      : data.trend === "declining"
                        ? "fill-red-600"
                        : "fill-blue-600"
                  }
                  opacity={0.8}
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-[var(--color-text-muted)] text-[9px]"
                >
                  {week.completedCount}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="fill-[var(--color-text-muted)] text-[8px]"
                >
                  {label}
                </text>
              </g>
            );
          })}
          {/* Trend line */}
          {data.weeks.length >= 2 && (
            <line
              x1={10 + barWidth / 2}
              y1={chartHeight - (data.weeks[0]!.completedCount / maxCount) * chartHeight}
              x2={(data.weeks.length - 1) * (barWidth + 4) + 10 + barWidth / 2}
              y2={
                chartHeight -
                (data.weeks[data.weeks.length - 1]!.completedCount / maxCount) * chartHeight
              }
              stroke="var(--color-text-muted)"
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.5}
            />
          )}
        </svg>
      </div>

      {/* Summary stats */}
      <div className="flex flex-wrap gap-4 text-[11px]">
        <div>
          <span className="text-[var(--color-text-muted)]">Average: </span>
          <span className="text-[var(--color-text-primary)] font-medium">
            {data.averageVelocity.toFixed(1)}/week
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Trend: </span>
          <span className={TREND_COLORS[data.trend]}>
            {data.trend} {TREND_ICONS[data.trend]}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Next week: </span>
          <span className="text-[var(--color-text-primary)]">
            ~{Math.round(data.nextWeekEstimate)}
          </span>
        </div>
        {data.completionWeeks !== null && data.remainingStories > 0 && (
          <div>
            <span className="text-[var(--color-text-muted)]">Completion: </span>
            <span className="text-[var(--color-text-primary)]">
              ~{Math.ceil(data.completionWeeks)} weeks ({data.remainingStories} remaining)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
