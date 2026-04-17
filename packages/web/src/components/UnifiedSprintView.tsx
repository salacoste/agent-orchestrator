"use client";

import { useState, useMemo } from "react";
import {
  type UnifiedSprintEntry,
  type UnifiedSprintSummary,
  type SprintFilterState,
  EMPTY_SPRINT_FILTERS,
} from "@/lib/types";
import {
  filterSprints,
  extractAvailableProjects,
  hasActiveSprintFilters,
} from "@/lib/sprint-filter";
import { computeSprintSummary } from "@/lib/unified-sprint-summary";
import { UnifiedSprintSummaryCards } from "./UnifiedSprintSummaryCards";
import { SprintCard } from "./SprintCard";
import { VelocityComparisonTable } from "./VelocityComparisonTable";
import { SprintFilterBar } from "./SprintFilterBar";

interface UnifiedSprintViewProps {
  initialSprints: UnifiedSprintEntry[];
  initialSummary: UnifiedSprintSummary;
}

export function UnifiedSprintView({ initialSprints, initialSummary }: UnifiedSprintViewProps) {
  const [filters, setFilters] = useState<SprintFilterState>(EMPTY_SPRINT_FILTERS);

  const availableProjects = useMemo(
    () => extractAvailableProjects(initialSprints),
    [initialSprints],
  );

  const filteredSprints = useMemo(
    () => filterSprints(initialSprints, filters),
    [initialSprints, filters],
  );

  const filteredSummary = useMemo(
    () =>
      hasActiveSprintFilters(filters) ? computeSprintSummary(filteredSprints) : initialSummary,
    [filters, filteredSprints, initialSummary],
  );

  if (initialSprints.length === 0) {
    return (
      <div className="flex flex-col gap-6 px-8 py-6">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Unified Sprints</h1>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center">
          <p className="text-[var(--color-text-muted)]">
            No sprint data found. Configure projects to see unified sprint view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Unified Sprints</h1>

      <SprintFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        availableProjects={availableProjects}
        filteredCount={{ filtered: filteredSprints.length, total: initialSprints.length }}
      />

      <UnifiedSprintSummaryCards summary={filteredSummary} />

      {filteredSprints.length >= 2 && <VelocityComparisonTable sprints={filteredSprints} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSprints.map((sprint) => (
          <SprintCard key={`${sprint.projectId}-${sprint.sprintName}`} sprint={sprint} />
        ))}
      </div>
    </div>
  );
}
