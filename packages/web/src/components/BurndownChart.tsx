"use client";

import { useState, useEffect } from "react";

interface DailyCompletion {
  date: string;
  count: number;
}

interface VelocityData {
  dailyCompletions: DailyCompletion[];
  totalStories: number;
  doneCount?: number;
}

export function BurndownChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<VelocityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let initialLoad = true;

    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/velocity`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load burndown data");
          return res.json();
        })
        .then((d) => {
          if (!cancelled) {
            setData(d as VelocityData);
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
  }, [projectId]);

  if (loading)
    return <div className="text-[var(--color-text-muted)] text-sm p-4">Loading burndown...</div>;
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || data.dailyCompletions.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Burndown</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          No completion history yet. Stories will appear here as they are completed.
        </p>
      </div>
    );
  }

  const { dailyCompletions, totalStories, doneCount } = data;
  const days = dailyCompletions.length;

  // SVG dimensions
  const width = 400;
  const height = 150;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Use ground-truth done count from tracker (accurate even if stories bounce)
  // Fall back to summing daily completions for backwards compatibility
  const totalCompleted = doneCount ?? dailyCompletions.reduce((sum, d) => sum + d.count, 0);
  let cumDone = 0;
  const points = dailyCompletions.map((d, i) => {
    cumDone += d.count;
    const remaining = Math.max(0, totalStories - cumDone);
    const x = padding.left + (i / Math.max(days - 1, 1)) * chartW;
    const y = padding.top + (1 - remaining / Math.max(totalStories, 1)) * chartH;
    return { x, y, date: d.date, remaining };
  });

  // Ideal line (from total to 0)
  const idealStart = { x: padding.left, y: padding.top };
  const idealEnd = { x: padding.left + chartW, y: padding.top + chartH };

  const actualPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
      <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Burndown</h3>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxWidth: 500 }}
        role="img"
        aria-label={`Burndown chart: ${totalCompleted} of ${totalStories} stories completed`}
      >
        {/* Grid lines */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartH}
          style={{ stroke: "var(--color-border-subtle)" }}
          strokeWidth={1}
        />
        <line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={padding.left + chartW}
          y2={padding.top + chartH}
          style={{ stroke: "var(--color-border-subtle)" }}
          strokeWidth={1}
        />

        {/* Ideal line */}
        <line
          x1={idealStart.x}
          y1={idealStart.y}
          x2={idealEnd.x}
          y2={idealEnd.y}
          style={{ stroke: "var(--color-border-default)" }}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Actual line */}
        <path
          d={actualPath}
          fill="none"
          style={{ stroke: "var(--color-status-success)" }}
          strokeWidth={2}
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} style={{ fill: "var(--color-status-success)" }} />
        ))}

        {/* Y axis labels */}
        <text
          x={padding.left - 5}
          y={padding.top + 4}
          textAnchor="end"
          style={{ fill: "var(--color-text-muted)" }}
          fontSize={10}
        >
          {totalStories}
        </text>
        <text
          x={padding.left - 5}
          y={padding.top + chartH + 4}
          textAnchor="end"
          style={{ fill: "var(--color-text-muted)" }}
          fontSize={10}
        >
          0
        </text>

        {/* X axis labels (first and last date) */}
        {dailyCompletions.length > 0 && (
          <>
            <text
              x={padding.left}
              y={height - 5}
              textAnchor="start"
              style={{ fill: "var(--color-text-muted)" }}
              fontSize={9}
            >
              {dailyCompletions[0].date.slice(5)}
            </text>
            <text
              x={padding.left + chartW}
              y={height - 5}
              textAnchor="end"
              style={{ fill: "var(--color-text-muted)" }}
              fontSize={9}
            >
              {dailyCompletions[dailyCompletions.length - 1].date.slice(5)}
            </text>
          </>
        )}
      </svg>
      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
        <span>{Math.max(0, totalStories - totalCompleted)} remaining</span>
        <span>{totalCompleted} completed</span>
      </div>
    </div>
  );
}
