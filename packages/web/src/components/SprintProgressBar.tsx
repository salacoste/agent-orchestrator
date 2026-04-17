"use client";

import type { SprintHealthStatus } from "@/lib/types";

interface SprintProgressBarProps {
  /** Completion percentage (0-100). Clamped if out of range. */
  progressPercent: number;
  /** Health status determining bar color. */
  health: SprintHealthStatus;
  /** Story counts for the tooltip breakdown. */
  stories: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    backlog: number;
  };
  /** Project name for the aria-label. */
  projectName: string;
}

function healthColorClass(health: SprintHealthStatus): string {
  switch (health) {
    case "on-track":
      return "bg-[var(--color-success)]";
    case "at-risk":
      return "bg-[var(--color-warning)]";
    case "blocked":
      return "bg-[var(--color-error)]";
  }
}

function buildTooltip(stories: SprintProgressBarProps["stories"], percent: number): string {
  return [
    `${stories.done} done / ${stories.total} total (${percent}%)`,
    `${stories.inProgress} in-progress`,
    `${stories.blocked} blocked`,
    `${stories.backlog} backlog`,
  ].join("\n");
}

export function SprintProgressBar({
  progressPercent,
  health,
  stories,
  projectName,
}: SprintProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progressPercent));
  const width = `${clamped}%`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
        <span>Progress</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-bg-inset)]">
        <div
          className={`h-2 rounded-full transition-all ${healthColorClass(health)}`}
          style={{ width }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${projectName} sprint progress`}
          title={buildTooltip(stories, clamped)}
        />
      </div>
    </div>
  );
}
