"use client";

import { useState, useEffect } from "react";

interface DailyThroughput {
  date: string;
  count: number;
  points: number;
}

interface LeadTimeStat {
  storyId: string;
  leadTimeMs: number;
  cycleTimeMs: number;
}

interface ColumnTrend {
  column: string;
  weeklyAvgMs: number[];
  trend: string;
  slope: number;
}

interface ThroughputData {
  dailyThroughput: DailyThroughput[];
  weeklyThroughput: Array<{ weekStart: string; count: number; points: number }>;
  leadTimes: LeadTimeStat[];
  averageLeadTimeMs: number;
  medianLeadTimeMs: number;
  averageCycleTimeMs: number;
  medianCycleTimeMs: number;
  flowEfficiency: number;
  columnTrends: ColumnTrend[];
  bottleneckTrend: string | null;
}

function formatDuration(ms: number): string {
  if (ms < 0) return "0m";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const totalDays = Math.floor(totalHours / 24);
  if (totalDays > 0) return `${totalDays}d`;
  return `${totalHours}h`;
}

export function ThroughputChart({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<ThroughputData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `?epic=${encodeURIComponent(epicFilter)}` : "";

    fetch(`/api/sprint/${encodeURIComponent(projectId)}/throughput${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load throughput data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d as ThroughputData);
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
  }, [projectId, epicFilter]);

  if (loading)
    return <div className="text-[var(--color-text-muted)] text-sm p-4">Loading throughput...</div>;
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || data.leadTimes.length === 0) {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
        No completed stories yet. Throughput metrics will appear as stories are done.
      </div>
    );
  }

  // SVG dimensions for weekly throughput bar chart
  const weeks = data.weeklyThroughput.slice(-12);
  const maxCount = Math.max(...weeks.map((w) => w.count), 1);
  const barW = 28;
  const barGap = 4;
  const chartW = weeks.length * (barW + barGap) + 20;
  const chartH = 120;
  const labelH = 24;

  // Lead time dot plot
  const leadTimes = data.leadTimes.slice(-30);
  const maxLead = Math.max(...leadTimes.map((l) => l.leadTimeMs), 1);
  const dotPlotW = Math.max(leadTimes.length * 16 + 40, 200);
  const dotPlotH = 80;

  const trendIcons: Record<string, string> = {
    increasing: "\u2191",
    stable: "\u2192",
    decreasing: "\u2193",
  };

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Avg Lead Time", value: formatDuration(data.averageLeadTimeMs) },
          { label: "Avg Cycle Time", value: formatDuration(data.averageCycleTimeMs) },
          {
            label: "Flow Efficiency",
            value: `${(data.flowEfficiency * 100).toFixed(0)}%`,
          },
          {
            label: "Bottleneck",
            value: data.bottleneckTrend ?? "None",
          },
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

      {/* Weekly throughput bar chart */}
      {weeks.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Weekly Throughput
          </h3>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH + labelH}`}
              className="w-full"
              style={{ maxWidth: 600 }}
              role="img"
              aria-label="Weekly throughput bar chart"
            >
              {weeks.map((week, i) => {
                const x = i * (barW + barGap) + 10;
                const h = (week.count / maxCount) * chartH;
                const y = chartH - h;

                return (
                  <g key={week.weekStart}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={3}
                      style={{ fill: "var(--color-status-success)" }}
                      opacity={0.7}
                    />
                    <text
                      x={x + barW / 2}
                      y={y - 4}
                      textAnchor="middle"
                      style={{ fill: "var(--color-text-muted)" }}
                      fontSize={9}
                    >
                      {week.count}
                    </text>
                    <text
                      x={x + barW / 2}
                      y={chartH + 14}
                      textAnchor="middle"
                      style={{ fill: "var(--color-text-muted)" }}
                      fontSize={8}
                      transform={`rotate(-30, ${x + barW / 2}, ${chartH + 14})`}
                    >
                      {week.weekStart.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Lead time distribution dot plot */}
      {leadTimes.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Lead Time Distribution (last {leadTimes.length} stories)
          </h3>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${dotPlotW} ${dotPlotH + 20}`}
              className="w-full"
              style={{ maxWidth: 600 }}
              role="img"
              aria-label="Lead time distribution"
            >
              {/* Avg line */}
              {(() => {
                const avgY = dotPlotH - (data.averageLeadTimeMs / maxLead) * dotPlotH;
                return (
                  <line
                    x1={0}
                    y1={avgY}
                    x2={dotPlotW}
                    y2={avgY}
                    stroke="var(--color-accent)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.5}
                  />
                );
              })()}

              {leadTimes.map((lt, i) => {
                const x = i * 16 + 20;
                const y = dotPlotH - (lt.leadTimeMs / maxLead) * dotPlotH;
                return (
                  <circle
                    key={lt.storyId}
                    cx={x}
                    cy={y}
                    r={4}
                    style={{ fill: "var(--color-accent)" }}
                    opacity={0.7}
                  >
                    <title>
                      {lt.storyId}: {formatDuration(lt.leadTimeMs)} lead /{" "}
                      {formatDuration(lt.cycleTimeMs)} cycle
                    </title>
                  </circle>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Column trends */}
      {data.columnTrends.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Column Trends
          </h3>
          <div className="space-y-1">
            {data.columnTrends.map((trend) => (
              <div key={trend.column} className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--color-text-muted)] w-28">{trend.column}</span>
                <span
                  className={
                    trend.trend === "increasing"
                      ? "text-red-400"
                      : trend.trend === "decreasing"
                        ? "text-green-400"
                        : "text-yellow-400"
                  }
                >
                  {trendIcons[trend.trend] ?? "\u2192"} {trend.trend}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
