"use client";

import { useCallback } from "react";
import type {
  ConflictHistoryFilter,
  ResourceConflictType,
  ConflictResolutionOutcome,
} from "@composio/ao-core";

interface ConflictHistoryFiltersProps {
  filter: ConflictHistoryFilter;
  onFilterChange: (filter: ConflictHistoryFilter) => void;
}

const RESOURCE_TYPES: ResourceConflictType[] = [
  "repository",
  "agent",
  "file-path",
  "external-service",
];
const OUTCOMES: ConflictResolutionOutcome[] = [
  "resolved",
  "auto-resolved",
  "dismissed",
  "escalated",
];

export function ConflictHistoryFilters({ filter, onFilterChange }: ConflictHistoryFiltersProps) {
  const update = useCallback(
    (patch: Partial<ConflictHistoryFilter>) => {
      onFilterChange({ ...filter, ...patch });
    },
    [filter, onFilterChange],
  );

  return (
    <div className="flex flex-wrap gap-3 mb-6 items-end">
      {/* Date From */}
      <div className="flex flex-col">
        <label htmlFor="hist-date-from" className="text-xs text-gray-500 mb-1">
          From
        </label>
        <input
          id="hist-date-from"
          type="date"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          value={filter.dateFrom ?? ""}
          onChange={(e) => update({ dateFrom: e.target.value || undefined })}
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col">
        <label htmlFor="hist-date-to" className="text-xs text-gray-500 mb-1">
          To
        </label>
        <input
          id="hist-date-to"
          type="date"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          value={filter.dateTo ?? ""}
          onChange={(e) => update({ dateTo: e.target.value || undefined })}
        />
      </div>

      {/* Resource Type */}
      <div className="flex flex-col">
        <label htmlFor="hist-resource-type" className="text-xs text-gray-500 mb-1">
          Resource Type
        </label>
        <select
          id="hist-resource-type"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          value={filter.resourceType ?? ""}
          onChange={(e) =>
            update({
              resourceType: (e.target.value || undefined) as ResourceConflictType | undefined,
            })
          }
        >
          <option value="">All</option>
          {RESOURCE_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {formatLabel(rt)}
            </option>
          ))}
        </select>
      </div>

      {/* Project ID */}
      <div className="flex flex-col">
        <label htmlFor="hist-project" className="text-xs text-gray-500 mb-1">
          Project
        </label>
        <input
          id="hist-project"
          type="text"
          placeholder="project-id"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-32"
          value={filter.projectId ?? ""}
          onChange={(e) => update({ projectId: e.target.value || undefined })}
        />
      </div>

      {/* Outcome */}
      <div className="flex flex-col">
        <label htmlFor="hist-outcome" className="text-xs text-gray-500 mb-1">
          Outcome
        </label>
        <select
          id="hist-outcome"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          value={filter.resolutionOutcome ?? ""}
          onChange={(e) =>
            update({
              resolutionOutcome: (e.target.value || undefined) as
                | ConflictResolutionOutcome
                | undefined,
            })
          }
        >
          <option value="">All</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {formatLabel(o)}
            </option>
          ))}
        </select>
      </div>

      {/* Clear */}
      <button
        type="button"
        className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md"
        onClick={() => onFilterChange({})}
      >
        Clear
      </button>
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
