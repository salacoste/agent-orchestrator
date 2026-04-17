"use client";

import { useMemo, useState } from "react";
import type { UnifiedSprintEntry } from "@/lib/types";

type SortColumn = "rank" | "project" | "velocity" | "progress";
type SortDirection = "asc" | "desc";

interface VelocityComparisonTableProps {
  sprints: UnifiedSprintEntry[];
}

function trendIndicator(trend: UnifiedSprintEntry["velocityTrend"]): {
  symbol: string;
  className: string;
  label: string;
} {
  switch (trend) {
    case "improving":
      return { symbol: "▲", className: "text-[var(--color-success)]", label: "Improving" };
    case "declining":
      return { symbol: "▼", className: "text-[var(--color-error)]", label: "Declining" };
    case "stable":
      return { symbol: "—", className: "text-[var(--color-text-muted)]", label: "Stable" };
    case "unknown":
      return { symbol: "?", className: "text-[var(--color-text-muted)]", label: "Unknown" };
  }
}

export function VelocityComparisonTable({ sprints }: VelocityComparisonTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("velocity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      // Default: rank/velocity/progress descending, project ascending
      setSortDirection(column === "project" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...sprints];
    const dir = sortDirection === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      switch (sortColumn) {
        case "velocity":
          return dir * (a.velocity - b.velocity);
        case "project":
          return dir * a.projectName.localeCompare(b.projectName);
        case "rank":
          // Rank sort = same as velocity sort (rank is derived from velocity)
          return dir * (a.velocity - b.velocity);
        case "progress":
          return dir * (a.progressPercent - b.progressPercent);
      }
    });

    return copy;
  }, [sprints, sortColumn, sortDirection]);

  function sortArrow(column: SortColumn): string {
    if (sortColumn !== column) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  function thClassName(column: SortColumn): string {
    const base =
      "cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]";
    return sortColumn === column ? `${base} text-[var(--color-text-primary)]` : base;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <table
        className="w-full text-sm"
        role="table"
        aria-label="Velocity comparison across projects"
      >
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th
              className={thClassName("rank")}
              role="columnheader"
              aria-sort={
                sortColumn === "rank"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              onClick={() => handleSort("rank")}
            >
              Rank{sortArrow("rank")}
            </th>
            <th
              className={thClassName("project")}
              role="columnheader"
              aria-sort={
                sortColumn === "project"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              onClick={() => handleSort("project")}
            >
              Project{sortArrow("project")}
            </th>
            <th
              className={thClassName("velocity")}
              role="columnheader"
              aria-sort={
                sortColumn === "velocity"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              onClick={() => handleSort("velocity")}
            >
              Velocity{sortArrow("velocity")}
            </th>
            <th
              className={thClassName("progress")}
              role="columnheader"
              aria-sort={
                sortColumn === "progress"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              onClick={() => handleSort("progress")}
            >
              Progress{sortArrow("progress")}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((sprint, index) => {
            const trend = trendIndicator(sprint.velocityTrend);
            return (
              <tr
                key={sprint.projectId}
                className="border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-bg-inset)]"
              >
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{index + 1}</td>
                <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                  {sprint.projectName}
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--color-text-primary)]">
                  {sprint.velocity.toFixed(2)} stories/day
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--color-text-muted)]">
                  {sprint.progressPercent}%
                </td>
                <td className={`px-3 py-2 ${trend.className}`} aria-label={trend.label}>
                  {trend.symbol}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
