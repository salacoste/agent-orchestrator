"use client";

import type { FilterState, PortfolioProject } from "@/lib/types";
import { hasActiveFilters } from "@/lib/portfolio-filter";

interface PortfolioFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableTags: string[];
  availableMetadata: Record<string, string[]>;
  projectCount: { filtered: number; total: number };
}

const STATUS_OPTIONS: Array<{ value: PortfolioProject["status"]; label: string }> = [
  { value: "active", label: "Active" },
  { value: "idle", label: "Idle" },
  { value: "error", label: "Error" },
];

export function PortfolioFilterBar({
  filters,
  onFiltersChange,
  availableTags,
  availableMetadata,
  projectCount,
}: PortfolioFilterBarProps) {
  const active = hasActiveFilters(filters);

  function handleStatusChange(value: string) {
    onFiltersChange({
      ...filters,
      status: value === "" ? null : (value as PortfolioProject["status"]),
    });
  }

  function handleTagToggle(tag: string) {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags });
  }

  function handleMetadataChange(key: string, value: string) {
    const { [key]: _, ...rest } = filters.metadata;
    const metadata = value === "" ? rest : { ...rest, [key]: value };
    onFiltersChange({ ...filters, metadata });
  }

  function handleClear() {
    onFiltersChange({ status: null, tags: [], metadata: {} });
  }

  const metadataKeys = Object.keys(availableMetadata);

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3"
      role="search"
      aria-label="Filter projects"
    >
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="status-filter"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Status
        </label>
        <select
          id="status-filter"
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

      {/* Tag filters */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((tag) => {
              const isSelected = filters.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-[var(--color-accent)] text-white"
                      : "border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata filters */}
      {metadataKeys.length > 0 &&
        metadataKeys.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <label
              htmlFor={`metadata-filter-${key}`}
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              {key}
            </label>
            <select
              id={`metadata-filter-${key}`}
              value={filters.metadata[key] ?? ""}
              onChange={(e) => handleMetadataChange(key, e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option value="">All</option>
              {availableMetadata[key].map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
        ))}

      {/* Project count */}
      <div className="ml-auto text-sm text-[var(--color-text-muted)]" aria-live="polite">
        {active ? (
          <>
            {projectCount.filtered} of {projectCount.total} projects
          </>
        ) : (
          <>{projectCount.total} projects</>
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
