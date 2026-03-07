"use client";

import { useState, useEffect } from "react";

interface TransitionReworkStat {
  from: string;
  to: string;
  count: number;
  averageReworkTimeMs: number;
}

interface WorstOffender {
  storyId: string;
  reworkCount: number;
  totalReworkTimeMs: number;
}

interface ReworkData {
  reworkRate: number;
  totalReworkEvents: number;
  totalReworkTimeMs: number;
  transitionStats: TransitionReworkStat[];
  worstOffenders: WorstOffender[];
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const totalDays = Math.floor(totalHours / 24);
  if (totalDays > 0) return `${totalDays}d ${totalHours % 24}h`;
  if (totalHours > 0) return `${totalHours}h`;
  const totalMinutes = Math.floor(ms / (1000 * 60));
  return `${totalMinutes}m`;
}

export function ReworkChart({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<ReworkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `?epic=${encodeURIComponent(epicFilter)}` : "";

    fetch(`/api/sprint/${encodeURIComponent(projectId)}/rework${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load rework data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d as ReworkData);
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
    return <div className="text-[var(--color-text-muted)] text-sm p-4">Loading rework data...</div>;
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || data.totalReworkEvents === 0) {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
        No rework detected. All story transitions were forward.
      </div>
    );
  }

  // Bar chart dimensions for transition stats
  const maxCount = Math.max(...data.transitionStats.map((t) => t.count), 1);
  const barHeight = 24;
  const barGap = 6;
  const labelWidth = 180;
  const chartWidth = 500;
  const maxBarWidth = chartWidth - labelWidth - 60;
  const svgHeight = data.transitionStats.length * (barHeight + barGap) + 10;

  // Color based on rework rate
  const reworkRateColor =
    data.reworkRate > 30
      ? "text-red-400"
      : data.reworkRate > 15
        ? "text-yellow-400"
        : "text-green-400";

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Rework Rate",
            value: `${data.reworkRate.toFixed(1)}%`,
            colorClass: reworkRateColor,
          },
          {
            label: "Total Events",
            value: String(data.totalReworkEvents),
            colorClass: "text-[var(--color-text-primary)]",
          },
          {
            label: "Total Rework Time",
            value: formatDuration(data.totalReworkTimeMs),
            colorClass: "text-[var(--color-text-primary)]",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 text-center"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{stat.label}</div>
            <div className={`text-[13px] font-semibold ${stat.colorClass}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Transition stats horizontal bar chart */}
      {data.transitionStats.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Rework Transitions
          </h3>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${svgHeight}`}
              className="w-full"
              style={{ maxWidth: 600 }}
              role="img"
              aria-label="Rework transition stats bar chart"
            >
              {data.transitionStats.map((stat, i) => {
                const y = i * (barHeight + barGap) + 5;
                const barW = (stat.count / maxCount) * maxBarWidth;
                const label = `${stat.from} \u2192 ${stat.to}`;

                return (
                  <g key={`${stat.from}-${stat.to}`}>
                    <text
                      x={labelWidth - 8}
                      y={y + barHeight / 2 + 4}
                      textAnchor="end"
                      style={{ fill: "var(--color-text-muted)" }}
                      fontSize={11}
                    >
                      {label}
                    </text>
                    <rect
                      x={labelWidth}
                      y={y}
                      width={Math.max(barW, 2)}
                      height={barHeight}
                      rx={3}
                      style={{ fill: "var(--color-status-error)" }}
                      opacity={0.7}
                    />
                    <text
                      x={labelWidth + Math.max(barW, 2) + 6}
                      y={y + barHeight / 2 + 4}
                      textAnchor="start"
                      style={{ fill: "var(--color-text-muted)" }}
                      fontSize={10}
                    >
                      {stat.count}x ({formatDuration(stat.averageReworkTimeMs)} avg)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Worst offenders */}
      {data.worstOffenders.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Worst Offenders
          </h3>
          <div className="space-y-1">
            {data.worstOffenders.map((offender) => (
              <div key={offender.storyId} className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--color-text-primary)] font-mono w-20">
                  {offender.storyId}
                </span>
                <span className="text-red-400">
                  {offender.reworkCount} rework{offender.reworkCount !== 1 ? "s" : ""}
                </span>
                {offender.totalReworkTimeMs > 0 && (
                  <span className="text-[var(--color-text-muted)]">
                    ({formatDuration(offender.totalReworkTimeMs)})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
