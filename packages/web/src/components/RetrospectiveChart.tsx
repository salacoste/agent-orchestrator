"use client";

import { useState, useEffect } from "react";

interface SprintPeriod {
  startDate: string;
  endDate: string;
  completedCount: number;
  averageCycleTimeMs: number;
  carryOverCount: number;
  storyIds: string[];
}

interface RetrospectiveData {
  periods: SprintPeriod[];
  velocityTrend: number[];
  averageVelocity: number;
  velocityChange: number;
  totalCompleted: number;
  overallAverageCycleTimeMs: number;
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

export function RetrospectiveChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<RetrospectiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let initialLoad = true;

    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/retro`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load retrospective data");
          return res.json();
        })
        .then((d) => {
          if (!cancelled) {
            setData(d as RetrospectiveData);
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
    return (
      <div className="text-[var(--color-text-muted)] text-sm p-4">Loading retrospective...</div>
    );
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || data.periods.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Sprint Retrospective
        </h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          No completed stories yet. Retrospective data will appear as stories are done.
        </p>
      </div>
    );
  }

  const { periods, averageVelocity, velocityChange, totalCompleted, overallAverageCycleTimeMs } =
    data;

  const maxCompleted = Math.max(...periods.map((p) => p.completedCount), 1);

  // SVG dimensions for vertical bar chart
  const barWidth = 36;
  const barGap = 12;
  const chartHeight = 160;
  const labelHeight = 40;
  const topPadding = 20;
  const leftPadding = 30;
  const svgWidth = leftPadding + periods.length * (barWidth + barGap) + barGap;
  const svgHeight = topPadding + chartHeight + labelHeight;

  // Average velocity line Y position
  const avgLineY = topPadding + chartHeight - (averageVelocity / maxCompleted) * chartHeight;

  const changeSign = velocityChange >= 0 ? "+" : "";
  const changeColor =
    velocityChange >= 0 ? "var(--color-status-success)" : "var(--color-status-error)";

  return (
    <div className="space-y-3">
      {/* Summary stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Total Completed", value: String(totalCompleted) },
          { label: "Avg Velocity", value: `${averageVelocity.toFixed(1)}/wk` },
          {
            label: "Velocity Change",
            value: `${changeSign}${velocityChange.toFixed(1)}%`,
            color: changeColor,
          },
          { label: "Avg Cycle Time", value: formatDuration(overallAverageCycleTimeMs) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 text-center"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{stat.label}</div>
            <div
              className="text-[13px] font-semibold"
              style={{ color: stat.color ?? "var(--color-text-primary)" }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Velocity bar chart */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Weekly Velocity
        </h3>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ maxWidth: 700 }}
          role="img"
          aria-label="Sprint velocity bar chart"
        >
          {/* Y-axis labels */}
          <text
            x={leftPadding - 6}
            y={topPadding + 4}
            textAnchor="end"
            style={{ fill: "var(--color-text-muted)" }}
            fontSize={9}
          >
            {maxCompleted}
          </text>
          <text
            x={leftPadding - 6}
            y={topPadding + chartHeight + 4}
            textAnchor="end"
            style={{ fill: "var(--color-text-muted)" }}
            fontSize={9}
          >
            0
          </text>

          {/* Average velocity dashed line */}
          {averageVelocity > 0 && (
            <>
              <line
                x1={leftPadding}
                y1={avgLineY}
                x2={svgWidth - barGap}
                y2={avgLineY}
                stroke="var(--color-status-warning)"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.7}
              />
              <text
                x={svgWidth - barGap + 4}
                y={avgLineY + 3}
                textAnchor="start"
                style={{ fill: "var(--color-status-warning)" }}
                fontSize={8}
              >
                avg
              </text>
            </>
          )}

          {/* Bars */}
          {periods.map((period, i) => {
            const x = leftPadding + i * (barWidth + barGap) + barGap / 2;
            const barH = (period.completedCount / maxCompleted) * chartHeight;
            const barY = topPadding + chartHeight - barH;

            // Short week label (MM/DD)
            const weekLabel = period.startDate.slice(5); // e.g., "01-05"

            return (
              <g key={period.startDate}>
                {/* Bar */}
                <rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={3}
                  style={{ fill: "var(--color-accent)" }}
                  opacity={0.7}
                />

                {/* Count label above bar */}
                <text
                  x={x + barWidth / 2}
                  y={barY - 4}
                  textAnchor="middle"
                  style={{ fill: "var(--color-text-primary)" }}
                  fontSize={10}
                  fontWeight={600}
                >
                  {period.completedCount}
                </text>

                {/* Week label below */}
                <text
                  x={x + barWidth / 2}
                  y={topPadding + chartHeight + 14}
                  textAnchor="middle"
                  style={{ fill: "var(--color-text-muted)" }}
                  fontSize={9}
                >
                  {weekLabel}
                </text>

                {/* Carry-over indicator */}
                {period.carryOverCount > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={topPadding + chartHeight + 28}
                    textAnchor="middle"
                    style={{ fill: "var(--color-status-warning)" }}
                    fontSize={8}
                  >
                    +{period.carryOverCount} carry
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
