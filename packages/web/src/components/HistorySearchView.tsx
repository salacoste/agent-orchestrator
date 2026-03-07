"use client";

import { useState, useEffect, useCallback } from "react";

interface HistoryEntry {
  timestamp: string;
  storyId: string;
  fromStatus: string;
  toStatus: string;
  comment?: string;
}

interface HistoryQueryResult {
  entries: HistoryEntry[];
  total: number;
}

export function HistorySearchView({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [storyFilter, setStoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [results, setResults] = useState<HistoryQueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(() => {
    if (!query && !storyFilter && !statusFilter && !fromDate && !toDate) {
      setResults(null);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (storyFilter) params.set("story", storyFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (epicFilter) params.set("epic", epicFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("limit", "50");

    fetch(`/api/sprint/${encodeURIComponent(projectId)}/history?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setResults(d as HistoryQueryResult);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, query, storyFilter, statusFilter, epicFilter, fromDate, toDate]);

  useEffect(() => {
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-3">
      {/* Search form */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search text..."
          className="flex-1 min-w-[150px] px-3 py-1.5 text-[12px] rounded bg-[var(--color-bg-inset)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
        />
        <input
          type="text"
          value={storyFilter}
          onChange={(e) => setStoryFilter(e.target.value)}
          placeholder="Story ID..."
          className="w-[120px] px-3 py-1.5 text-[12px] rounded bg-[var(--color-bg-inset)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-[12px] rounded bg-[var(--color-bg-inset)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]"
        >
          <option value="">All statuses</option>
          <option value="backlog">Backlog</option>
          <option value="ready-for-dev">Ready</option>
          <option value="in-progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          placeholder="From..."
          className="w-[140px] px-2 py-1.5 text-[11px] rounded bg-[var(--color-bg-inset)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          placeholder="To..."
          className="w-[140px] px-2 py-1.5 text-[11px] rounded bg-[var(--color-bg-inset)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]"
        />
      </div>

      {/* Results */}
      {loading && <div className="text-[11px] text-[var(--color-text-muted)]">Searching...</div>}

      {results && (
        <div className="space-y-1">
          <div className="text-[10px] text-[var(--color-text-muted)]">
            {results.total} {results.total === 1 ? "result" : "results"}
            {results.entries.length < results.total
              ? ` (showing last ${results.entries.length})`
              : ""}
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {results.entries.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded bg-[var(--color-bg-inset)] text-[11px]"
              >
                <span className="text-[var(--color-text-muted)] w-[70px] shrink-0">
                  {entry.timestamp.slice(0, 10)}
                </span>
                <span className="font-mono text-[var(--color-text-secondary)] w-[60px] shrink-0">
                  {entry.storyId}
                </span>
                <span className="text-[var(--color-text-muted)]">{entry.fromStatus}</span>
                <span className="text-[var(--color-text-muted)]">&rarr;</span>
                <span className="text-[var(--color-text-primary)]">{entry.toStatus}</span>
                {entry.comment && (
                  <span className="text-[var(--color-text-muted)] truncate ml-auto">
                    {entry.comment}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results && results.entries.length === 0 && (
        <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
          No matching history entries.
        </div>
      )}
    </div>
  );
}
