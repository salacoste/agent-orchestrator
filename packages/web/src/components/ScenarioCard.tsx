"use client";

import type { WhatIfScenario } from "@/lib/types";
import { statusBadgeColor, statusLabel, formatDate, relativeTime } from "@/lib/scenario-helpers";

interface ScenarioCardProps {
  scenario: WhatIfScenario;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function ScenarioCard({
  scenario,
  onOpen,
  onDelete,
  selectable,
  selected,
  onToggleSelect,
}: ScenarioCardProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-shadow hover:shadow-md">
      {/* Header: checkbox + name + status badge */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(scenario.id)}
              aria-label={`Select ${scenario.name}`}
              className="mt-0.5"
            />
          )}
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {scenario.name}
          </h3>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(scenario.status)}`}
        >
          {statusLabel(scenario.status)}
        </span>
      </div>

      {/* Metadata */}
      <div className="mb-3 space-y-1 text-xs text-[var(--color-text-muted)]">
        <div>Created {formatDate(scenario.createdAt)}</div>
        {scenario.updatedAt && <div>Last modified: {relativeTime(scenario.updatedAt)}</div>}
        <div>Projects: {scenario.projectIds.length}</div>
        <div>Stories: {scenario.stories.length} captured</div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onOpen(scenario.id)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => onDelete(scenario.id)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-error)] transition-colors hover:border-[var(--color-error)] hover:opacity-80"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
