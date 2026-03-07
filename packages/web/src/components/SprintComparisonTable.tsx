"use client";

import { useState, useEffect } from "react";

type MetricTrend = "improving" | "stable" | "declining";

interface PeriodMetrics {
  weekStart: string;
  completedCount: number;
  completedPoints?: number;
  avgCycleTimeMs: number;
  flowEfficiency: number;
  bottleneckColumn: string | null;
  carryOverCount: number;
  avgWip: number;
}

interface ComparisonData {
  periods: PeriodMetrics[];
  trends: {
    velocity: MetricTrend;
    cycleTime: MetricTrend;
    flowEfficiency: MetricTrend;
    wip: MetricTrend;
  };
  hasPoints: boolean;
}

function formatMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(0)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

const TREND_ARROWS: Record<MetricTrend, { icon: string; color: string }> = {
  improving: { icon: "\u2191", color: "text-green-400" },
  stable: { icon: "\u2192", color: "text-yellow-400" },
  declining: { icon: "\u2193", color: "text-red-400" },
};

export function SprintComparisonTable({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `&epic=${encodeURIComponent(epicFilter)}` : "";
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/comparison?weeks=6${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load comparison data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as ComparisonData);
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
      <div className="text-[var(--color-text-muted)] text-[11px]">Loading comparison data...</div>
    );
  }
  if (data.periods.length === 0) {
    return (
      <div className="text-[var(--color-text-muted)] text-[11px]">
        No comparison data available.
      </div>
    );
  }

  const TrendBadge = ({ label, trend }: { label: string; trend: MetricTrend }) => {
    const { icon, color } = TREND_ARROWS[trend];
    return (
      <span className={`text-[10px] ${color}`}>
        {label} {icon}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Trend summary */}
      <div className="flex gap-4 flex-wrap">
        <TrendBadge label="Velocity" trend={data.trends.velocity} />
        <TrendBadge label="Cycle Time" trend={data.trends.cycleTime} />
        <TrendBadge label="Flow Eff" trend={data.trends.flowEfficiency} />
        <TrendBadge label="WIP" trend={data.trends.wip} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[var(--color-text-tertiary)] text-[10px] uppercase tracking-wider">
              <th className="text-left py-1 pr-2">Week</th>
              <th className="text-right py-1 px-2">Velocity</th>
              {data.hasPoints && <th className="text-right py-1 px-2">Points</th>}
              <th className="text-right py-1 px-2">Cycle Time</th>
              <th className="text-right py-1 px-2">Flow Eff</th>
              <th className="text-right py-1 px-2">WIP</th>
              <th className="text-right py-1 px-2">Carry</th>
              <th className="text-left py-1 pl-2">Bottleneck</th>
            </tr>
          </thead>
          <tbody>
            {data.periods.map((p) => (
              <tr
                key={p.weekStart}
                className="border-t border-[var(--color-border-muted)] hover:bg-[var(--color-bg-inset)]"
              >
                <td className="py-1.5 pr-2 text-[var(--color-text-muted)] font-mono">
                  {p.weekStart.slice(5)}
                </td>
                <td className="py-1.5 px-2 text-right text-[var(--color-text-primary)]">
                  {p.completedCount}
                </td>
                {data.hasPoints && (
                  <td className="py-1.5 px-2 text-right text-blue-400">{p.completedPoints ?? 0}</td>
                )}
                <td className="py-1.5 px-2 text-right text-[var(--color-text-primary)]">
                  {p.avgCycleTimeMs > 0 ? formatMs(p.avgCycleTimeMs) : "-"}
                </td>
                <td className="py-1.5 px-2 text-right">
                  <span
                    className={
                      p.flowEfficiency > 0.5
                        ? "text-green-400"
                        : p.flowEfficiency > 0.3
                          ? "text-yellow-400"
                          : "text-red-400"
                    }
                  >
                    {Math.round(p.flowEfficiency * 100)}%
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right text-[var(--color-text-primary)]">
                  {Math.round(p.avgWip)}
                </td>
                <td className="py-1.5 px-2 text-right text-[var(--color-text-muted)]">
                  {p.carryOverCount}
                </td>
                <td className="py-1.5 pl-2 text-[var(--color-text-muted)]">
                  {p.bottleneckColumn ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
