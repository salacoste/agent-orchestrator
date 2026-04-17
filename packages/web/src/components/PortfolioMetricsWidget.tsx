"use client";

import type { PortfolioMetrics } from "@/lib/types";
import { getHealthScoreColor, getHealthStatusLabel } from "@/lib/portfolio-metrics";

interface PortfolioMetricsWidgetProps {
  metrics: PortfolioMetrics;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  tooltip: string;
  colorClass?: string;
}

function MetricCard({ label, value, tooltip, colorClass }: MetricCardProps) {
  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-colors hover:border-[var(--color-border-hover)]"
      title={tooltip}
    >
      <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${colorClass ?? "text-[var(--color-text-primary)]"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function PortfolioMetricsWidget({ metrics }: PortfolioMetricsWidgetProps) {
  const healthColor = getHealthScoreColor(metrics.sprintHealthScore);
  const healthLabel = getHealthStatusLabel(metrics.sprintHealthScore);

  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-4"
      role="region"
      aria-label="Portfolio Metrics"
    >
      <MetricCard
        label="Total Agents"
        value={metrics.totalAgents}
        tooltip="Total active agents across all projects"
      />
      <MetricCard
        label="Stories"
        value={`${metrics.stories.done}/${metrics.stories.total}`}
        tooltip={`Backlog: ${metrics.stories.backlog}, In Progress: ${metrics.stories.inProgress}, Done: ${metrics.stories.done}, Blocked: ${metrics.stories.blocked}`}
      />
      <MetricCard
        label="Sprint Health"
        value={`${metrics.sprintHealthScore}%`}
        tooltip={`Sprint health: ${healthLabel}. Based on completion rate minus blocked penalty.`}
        colorClass={
          healthColor === "var(--color-success)"
            ? "text-[var(--color-success)]"
            : healthColor === "var(--color-warning)"
              ? "text-[var(--color-warning)]"
              : "text-[var(--color-error)]"
        }
      />
      <MetricCard
        label="Utilization"
        value={`${metrics.utilizationPercent}%`}
        tooltip="Percentage of active projects across portfolio"
      />
    </div>
  );
}
