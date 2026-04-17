"use client";

import { type SprintFilterState, EMPTY_SPRINT_FILTERS } from "@/lib/types";
import { hasActiveSprintFilters } from "@/lib/sprint-filter";

interface SprintFilterBarProps {
  filters: SprintFilterState;
  onFiltersChange: (filters: SprintFilterState) => void;
  availableProjects: { id: string; name: string }[];
  filteredCount: { filtered: number; total: number };
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "planning", label: "Planning" },
] as const;

const HEALTH_OPTIONS = [
  { value: "on-track", label: "On Track" },
  { value: "at-risk", label: "At Risk" },
  { value: "blocked", label: "Blocked" },
] as const;

export function SprintFilterBar({
  filters,
  onFiltersChange,
  availableProjects,
  filteredCount,
}: SprintFilterBarProps) {
  const active = hasActiveSprintFilters(filters);

  function handleStatusChange(value: string) {
    const validStatuses = STATUS_OPTIONS.map((o) => o.value);
    onFiltersChange({
      ...filters,
      status:
        value === "" || !validStatuses.includes(value as (typeof validStatuses)[number])
          ? null
          : (value as (typeof validStatuses)[number]),
    });
  }

  function handleHealthChange(value: string) {
    const validHealths = HEALTH_OPTIONS.map((o) => o.value);
    onFiltersChange({
      ...filters,
      health:
        value === "" || !validHealths.includes(value as (typeof validHealths)[number])
          ? null
          : (value as (typeof validHealths)[number]),
    });
  }

  function handleProjectChange(value: string) {
    onFiltersChange({
      ...filters,
      projectId: value === "" ? null : value,
    });
  }

  function handleDateStartChange(value: string) {
    const currentEnd = filters.dateRange?.end ?? "";
    if (value === "" && currentEnd === "") {
      onFiltersChange({ ...filters, dateRange: null });
    } else {
      onFiltersChange({ ...filters, dateRange: { start: value, end: currentEnd } });
    }
  }

  function handleDateEndChange(value: string) {
    const currentStart = filters.dateRange?.start ?? "";
    if (currentStart === "" && value === "") {
      onFiltersChange({ ...filters, dateRange: null });
    } else {
      onFiltersChange({ ...filters, dateRange: { start: currentStart, end: value } });
    }
  }

  function handleClear() {
    onFiltersChange(EMPTY_SPRINT_FILTERS);
  }

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3"
      role="search"
      aria-label="Filter sprints"
    >
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="sprint-status-filter"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Status
        </label>
        <select
          id="sprint-status-filter"
          value={filters.status ?? ""}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Health filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="sprint-health-filter"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Health
        </label>
        <select
          id="sprint-health-filter"
          value={filters.health ?? ""}
          onChange={(e) => handleHealthChange(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          <option value="">All</option>
          {HEALTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Project filter */}
      {availableProjects.length > 1 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="sprint-project-filter"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Project
          </label>
          <select
            id="sprint-project-filter"
            value={filters.projectId ?? ""}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="">All Projects</option>
            {availableProjects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="sprint-date-start"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          From
        </label>
        <input
          id="sprint-date-start"
          type="date"
          value={filters.dateRange?.start ?? ""}
          onChange={(e) => handleDateStartChange(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <label
          htmlFor="sprint-date-end"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          To
        </label>
        <input
          id="sprint-date-end"
          type="date"
          value={filters.dateRange?.end ?? ""}
          onChange={(e) => handleDateEndChange(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Sprint count */}
      <div className="ml-auto text-sm text-[var(--color-text-muted)]" aria-live="polite">
        {active ? (
          <>
            Showing {filteredCount.filtered} of {filteredCount.total} sprints
          </>
        ) : (
          <>{filteredCount.total} sprints</>
        )}
      </div>

      {/* Clear button */}
      {active && (
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
