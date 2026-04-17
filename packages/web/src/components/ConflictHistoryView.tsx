"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ConflictHistoryEntry,
  ConflictHistoryFilter,
  ConflictPatternSummary as ConflictPatternSummaryType,
} from "@composio/ao-core";
import { ConflictHistoryFilters } from "./ConflictHistoryFilters";
import { ConflictHistoryList } from "./ConflictHistoryList";
import { ConflictPatternSummary } from "./ConflictPatternSummary";

interface HistoryResponse {
  entries: ConflictHistoryEntry[];
  patterns: ConflictPatternSummaryType;
  filter: ConflictHistoryFilter;
}

export function ConflictHistoryView() {
  const [entries, setEntries] = useState<ConflictHistoryEntry[]>([]);
  const [patterns, setPatterns] = useState<ConflictPatternSummaryType | null>(null);
  const [filter, setFilter] = useState<ConflictHistoryFilter>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
      if (filter.dateTo) params.set("dateTo", filter.dateTo);
      if (filter.resourceType) params.set("resourceType", filter.resourceType);
      if (filter.projectId) params.set("projectId", filter.projectId);
      if (filter.resolutionOutcome) params.set("outcome", filter.resolutionOutcome);

      const qs = params.toString();
      const url = `/api/conflicts/history${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data: HistoryResponse = await res.json();
      setEntries(data.entries);
      setPatterns(data.patterns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
      if (filter.dateTo) params.set("dateTo", filter.dateTo);
      if (filter.resourceType) params.set("resourceType", filter.resourceType);
      if (filter.projectId) params.set("projectId", filter.projectId);
      if (filter.resolutionOutcome) params.set("outcome", filter.resolutionOutcome);

      const qs = params.toString();
      const url = `/api/conflicts/history/export${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match?.[1] ?? "conflict-history.json";

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }, [filter]);

  return (
    <div>
      {/* Filter bar */}
      <ConflictHistoryFilters filter={filter} onFilterChange={setFilter} />

      {/* Pattern summary */}
      <ConflictPatternSummary patterns={patterns} />

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Export button */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          Export JSON
        </button>
      </div>

      {/* History list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading history...</div>
      ) : (
        <ConflictHistoryList entries={entries} />
      )}
    </div>
  );
}
