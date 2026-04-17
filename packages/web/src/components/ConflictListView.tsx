"use client";

import { useMemo, useState } from "react";
import type {
  ResourceConflict,
  ResourceConflictType,
  ResourceConflictSeverity,
} from "@composio/ao-core";
import { ConflictSeverityBadge } from "./ConflictSeverityBadge";

interface ConflictListViewProps {
  conflicts: ResourceConflict[];
  onSelectConflict: (conflict: ResourceConflict) => void;
  selectedConflictId?: string;
  /** IDs of conflicts that arrived via SSE (not in initial load) */
  newConflictIds?: Set<string>;
}

const RESOURCE_TYPES: ResourceConflictType[] = [
  "repository",
  "file-path",
  "agent",
  "external-service",
];
const SEVERITY_LEVELS: ResourceConflictSeverity[] = ["critical", "high", "medium", "low"];

export function ConflictListView({
  conflicts,
  onSelectConflict,
  selectedConflictId,
  newConflictIds,
}: ConflictListViewProps) {
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceConflictType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<ResourceConflictSeverity | "all">("all");

  const filtered = useMemo(() => {
    return conflicts.filter((c) => {
      if (resourceTypeFilter !== "all" && c.resourceType !== resourceTypeFilter) return false;
      if (severityFilter !== "all" && c.severity !== severityFilter) return false;
      return true;
    });
  }, [conflicts, resourceTypeFilter, severityFilter]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={resourceTypeFilter}
          onChange={(e) => setResourceTypeFilter(e.target.value as ResourceConflictType | "all")}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
          aria-label="Filter by resource type"
        >
          <option value="all">All resource types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("-", " ")}
            </option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as ResourceConflictSeverity | "all")}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
          aria-label="Filter by severity"
        >
          <option value="all">All severities</option>
          {SEVERITY_LEVELS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <span className="text-sm text-gray-400">
          {filtered.length} of {conflicts.length} conflicts
        </span>
      </div>

      {/* Conflict list */}
      {filtered.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
          No conflicts detected
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((conflict) => {
            const isNew = newConflictIds?.has(conflict.id) ?? false;
            const isSelected = selectedConflictId === conflict.id;
            return (
              <button
                key={conflict.id}
                onClick={() => onSelectConflict(conflict)}
                className={`w-full text-left bg-white border rounded-lg p-3 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ConflictSeverityBadge severity={conflict.severity} />
                    <span className="text-xs text-gray-500 uppercase">
                      {conflict.resourceType.replaceAll("-", " ")}
                    </span>
                    {isNew && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        New
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(conflict.detectedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1.5 text-sm text-gray-700 font-mono truncate">
                  {conflict.resourceIdentifier}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {conflict.competingProjects.length} competing project
                  {conflict.competingProjects.length !== 1 ? "s" : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
