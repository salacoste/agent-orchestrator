"use client";

import { useState, useEffect } from "react";
import type { UnifiedSprintEntry, SprintHealthStatus } from "@/lib/types";
import { SprintProgressBar } from "./SprintProgressBar";

interface SprintCardProps {
  sprint: UnifiedSprintEntry;
}

function healthLabel(health: SprintHealthStatus): string {
  switch (health) {
    case "on-track":
      return "On Track";
    case "at-risk":
      return "At Risk";
    case "blocked":
      return "Blocked";
  }
}

function healthBadgeColor(health: SprintHealthStatus): string {
  switch (health) {
    case "on-track":
      return "bg-[var(--color-success)]/10 text-[var(--color-success)]";
    case "at-risk":
      return "bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
    case "blocked":
      return "bg-[var(--color-error)]/10 text-[var(--color-error)]";
  }
}

function detailBorderColor(health: SprintHealthStatus): string {
  switch (health) {
    case "at-risk":
      return "border-[var(--color-warning)]";
    case "blocked":
      return "border-[var(--color-error)]";
    default:
      return "border-[var(--color-border)]";
  }
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export function SprintCard({ sprint }: SprintCardProps) {
  const hasReasons = sprint.healthReasons.length > 0;
  const autoExpand = sprint.health === "blocked" && hasReasons;
  const [expanded, setExpanded] = useState(autoExpand);
  const [prevAutoExpand, setPrevAutoExpand] = useState(autoExpand);

  // Sync expanded state when health transitions to blocked (e.g., via SSE update)
  useEffect(() => {
    if (autoExpand && !prevAutoExpand) {
      setExpanded(true);
    }
    setPrevAutoExpand(autoExpand);
  }, [autoExpand, prevAutoExpand]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-colors hover:border-[var(--color-border-hover)]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {sprint.projectName}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">{sprint.sprintName}</p>
        </div>
        {hasReasons ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${healthBadgeColor(sprint.health)} cursor-pointer`}
            aria-expanded={expanded}
            aria-label={`${healthLabel(sprint.health)} — toggle details`}
          >
            {healthLabel(sprint.health)}
            <span aria-hidden="true">{expanded ? " ▲" : " ▼"}</span>
          </button>
        ) : (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${healthBadgeColor(sprint.health)}`}
          >
            {healthLabel(sprint.health)}
          </span>
        )}
      </div>

      {/* Date range */}
      {(sprint.startDate || sprint.endDate) && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
        </p>
      )}

      {/* Progress bar */}
      <SprintProgressBar
        progressPercent={sprint.progressPercent}
        health={sprint.health}
        stories={sprint.stories}
        projectName={sprint.projectName}
      />

      {/* Expandable risk detail */}
      {hasReasons && expanded && (
        <div
          className={`rounded-md border-l-4 ${detailBorderColor(sprint.health)} bg-[var(--color-bg-inset)] px-3 py-2`}
        >
          <ul className="space-y-1 text-xs text-[var(--color-text-muted)]">
            {sprint.healthReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Story breakdown */}
      <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
        <span title="Total stories">{sprint.stories.total} total</span>
        <span title="Done">{sprint.stories.done} done</span>
        {sprint.stories.inProgress > 0 && (
          <span title="In progress">{sprint.stories.inProgress} active</span>
        )}
        {sprint.stories.blocked > 0 && (
          <span className="text-[var(--color-error)]" title="Blocked">
            {sprint.stories.blocked} blocked
          </span>
        )}
      </div>
    </div>
  );
}
