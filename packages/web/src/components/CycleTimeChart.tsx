"use client";

import { useState, useEffect } from "react";

interface ColumnDwell {
  column: string;
  dwellMs: number;
}

interface CycleTimeData {
  averageCycleTimeMs: number;
  medianCycleTimeMs: number;
  throughputPerDay: number;
  throughputPerWeek: number;
  completedCount: number;
  averageColumnDwells: ColumnDwell[];
  bottleneckColumn: string | null;
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

export function CycleTimeChart({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<CycleTimeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let initialLoad = true;
    const epicParam = epicFilter ? `?epic=${encodeURIComponent(epicFilter)}` : "";

    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/metrics${epicParam}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load metrics data");
          return res.json();
        })
        .then((d) => {
          if (!cancelled) {
            setData(d as CycleTimeData);
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
  }, [projectId, epicFilter]);

  if (loading)
    return <div className="text-[var(--color-text-muted)] text-sm p-4">Loading metrics...</div>;
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || data.completedCount === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Cycle Time</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          No completed stories yet. Metrics will appear as stories are done.
        </p>
      </div>
    );
  }

  const { averageColumnDwells, bottleneckColumn } = data;
  const maxDwell = Math.max(...averageColumnDwells.map((d) => d.dwellMs), 1);

  // SVG dimensions for horizontal bar chart
  const barHeight = 24;
  const barGap = 6;
  const labelWidth = 110;
  const chartWidth = 300;
  const svgWidth = labelWidth + chartWidth + 80;
  const svgHeight = averageColumnDwells.length * (barHeight + barGap) + 10;

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Avg Cycle Time", value: formatDuration(data.averageCycleTimeMs) },
          { label: "Median", value: formatDuration(data.medianCycleTimeMs) },
          { label: "Throughput", value: `${data.throughputPerDay.toFixed(2)}/day` },
          { label: "Completed", value: String(data.completedCount) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 text-center"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{stat.label}</div>
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Column dwell times bar chart */}
      {averageColumnDwells.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Avg Column Dwell Time
          </h3>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full"
            style={{ maxWidth: 600 }}
            role="img"
            aria-label="Column dwell times bar chart"
          >
            {averageColumnDwells.map((dwell, i) => {
              const y = i * (barHeight + barGap);
              const barW = (dwell.dwellMs / maxDwell) * chartWidth;
              const isBottleneck = dwell.column === bottleneckColumn;

              return (
                <g key={dwell.column}>
                  {/* Column label */}
                  <text
                    x={labelWidth - 8}
                    y={y + barHeight / 2 + 4}
                    textAnchor="end"
                    style={{
                      fill: isBottleneck ? "var(--color-status-error)" : "var(--color-text-muted)",
                    }}
                    fontSize={11}
                    fontWeight={isBottleneck ? 600 : 400}
                  >
                    {dwell.column}
                  </text>

                  {/* Bar */}
                  <rect
                    x={labelWidth}
                    y={y}
                    width={Math.max(barW, 2)}
                    height={barHeight}
                    rx={3}
                    style={{
                      fill: isBottleneck ? "var(--color-status-error)" : "var(--color-accent)",
                    }}
                    opacity={isBottleneck ? 0.8 : 0.6}
                  />

                  {/* Duration label */}
                  <text
                    x={labelWidth + Math.max(barW, 2) + 6}
                    y={y + barHeight / 2 + 4}
                    textAnchor="start"
                    style={{ fill: "var(--color-text-muted)" }}
                    fontSize={10}
                  >
                    {formatDuration(dwell.dwellMs)}
                    {isBottleneck ? " (bottleneck)" : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
