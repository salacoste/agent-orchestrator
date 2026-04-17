"use client";

import type { UnifiedSprintSummary } from "@/lib/types";

interface UnifiedSprintSummaryCardsProps {
  summary: UnifiedSprintSummary;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  tooltip: string;
  valueClassName?: string;
}

function MetricCard({ label, value, tooltip, valueClassName }: MetricCardProps) {
  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-colors hover:border-[var(--color-border-hover)]"
      title={tooltip}
    >
      <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${valueClassName ?? "text-[var(--color-text-primary)]"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function UnifiedSprintSummaryCards({ summary }: UnifiedSprintSummaryCardsProps) {
  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-7"
      role="region"
      aria-label="Sprint Summary"
    >
      <MetricCard
        label="Total Sprints"
        value={summary.totalSprints}
        tooltip="Number of projects with sprint data"
      />
      <MetricCard
        label="Active Sprints"
        value={summary.activeSprints}
        tooltip="Projects with status 'active'"
      />
      <MetricCard
        label="Planning Sprints"
        value={summary.planningSprints}
        tooltip="Projects with status 'planning' (not yet started)"
      />
      <MetricCard
        label="Stories Done"
        value={`${summary.storiesDone}/${summary.totalStories}`}
        tooltip={`Total stories: ${summary.totalStories}, Done: ${summary.storiesDone}`}
      />
      <MetricCard
        label="Avg Progress"
        value={`${summary.avgProgress}%`}
        tooltip="Average completion percentage across all sprints"
      />
      <MetricCard
        label="At Risk"
        value={summary.atRiskSprints}
        tooltip={`Sprints flagged as at-risk or blocked`}
        valueClassName={summary.atRiskSprints > 0 ? "text-[var(--color-warning)]" : undefined}
      />
      <MetricCard
        label="Avg Velocity"
        value={summary.avgVelocity > 0 ? `${summary.avgVelocity.toFixed(2)}/day` : "—"}
        tooltip={`Average stories completed per day across active sprints (max: ${summary.maxVelocity.toFixed(2)})`}
      />
    </div>
  );
}
