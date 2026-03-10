"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DLQEntry, DLQStats } from "@composio/ao-core";

interface DLQResponse {
  stats: DLQStats;
  entries: DLQEntry[];
}

function formatAge(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function DeadLetterQueueViewer({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DLQResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [purging, setPurging] = useState(false);
  const [filterOperation, setFilterOperation] = useState<string>("all");
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [retryResults, setRetryResults] = useState<
    Map<string, { success: boolean; message: string }>
  >(new Map());

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/dlq?format=all&project=${encodeURIComponent(projectId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load DLQ");
        return res.json();
      })
      .then((d: DLQResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load DLQ:", err);
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleExpand = (errorId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(errorId)) next.delete(errorId);
      else next.add(errorId);
      return next;
    });
  };

  const handlePurge = async () => {
    if (!confirm("Purge all DLQ entries older than 7 days?")) return;

    setPurging(true);
    try {
      const res = await fetch("/api/dlq?olderThan=7d", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to purge DLQ");
      const result = await res.json();
      alert(`Purged ${result.purged} entries`);
      fetchData();
    } catch (err) {
      console.error("Failed to purge DLQ:", err);
      alert("Failed to purge DLQ");
    } finally {
      setPurging(false);
    }
  };

  const handleRetry = async (errorId: string) => {
    setRetrying((prev) => new Set(prev).add(errorId));
    setRetryResults((prev) => {
      const next = new Map(prev);
      next.delete(errorId);
      return next;
    });

    try {
      const res = await fetch(`/api/dlq/${errorId}/retry`, { method: "POST" });
      const result = await res.json();

      setRetryResults((prev) => {
        const next = new Map(prev);
        next.set(errorId, {
          success: result.success,
          message: result.success ? "Retry successful" : result.error || "Retry failed",
        });
        return next;
      });

      if (result.success) {
        // Remove from list after successful retry
        setTimeout(() => {
          fetchData();
        }, 1000);
      }
    } catch (err) {
      setRetryResults((prev) => {
        const next = new Map(prev);
        next.set(errorId, {
          success: false,
          message: err instanceof Error ? err.message : "Retry failed",
        });
        return next;
      });
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(errorId);
        return next;
      });
    }
  };

  // Get unique operation types for filter
  const operationTypes = useMemo(() => {
    if (!data?.stats.byOperation) return ["all"];
    return ["all", ...Object.keys(data.stats.byOperation)];
  }, [data?.stats.byOperation]);

  // Filter entries by operation type
  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    if (filterOperation === "all") return data.entries;
    return data.entries.filter((entry) => entry.operation === filterOperation);
  }, [data?.entries, filterOperation]);

  if (loading) {
    return (
      <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
        <div className="text-sm text-[var(--color-text-muted)]">Loading DLQ...</div>
      </div>
    );
  }

  if (!data || data.stats.totalEntries === 0) {
    return (
      <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Dead Letter Queue
            </h3>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              ✓ No failed operations
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Dead Letter Queue
          </h3>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {stats.totalEntries} failed operation{stats.totalEntries !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={handlePurge}
          disabled={purging}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-50 transition-colors"
        >
          {purging ? "Purging..." : "Purge Old (7d)"}
        </button>
      </div>

      {stats.oldestEntry && (
        <div className="text-xs text-[var(--color-text-muted)] mb-3">
          Oldest: {formatAge(stats.oldestEntry)}
          {stats.totalEntries > 100 && <span className="ml-2 text-yellow-400">⚠ Large queue</span>}
        </div>
      )}

      {/* Operation type filter */}
      <div className="mb-3">
        <select
          value={filterOperation}
          onChange={(e) => setFilterOperation(e.target.value)}
          className="text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-primary)]"
        >
          {operationTypes.map((op) => (
            <option key={op} value={op}>
              {op === "all" ? "All operations" : `${op} (${stats.byOperation[op] || 0})`}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-text-muted)] ml-2">
          Showing {filteredEntries.length} of {stats.totalEntries}
        </span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredEntries.map((entry) => {
          const isExpanded = expanded.has(entry.errorId);
          const isRetrying = retrying.has(entry.errorId);
          const retryResult = retryResults.get(entry.errorId);

          return (
            <div
              key={entry.errorId}
              className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2"
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpand(entry.errorId)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                    {entry.operation}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {formatAge(entry.failedAt)} • {entry.retryCount} retr
                    {entry.retryCount === 1 ? "y" : "ies"}
                  </div>
                </div>
                <button className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] ml-2">
                  {isExpanded ? "Hide" : "Details"}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    <div className="font-medium mb-1">{entry.failureReason}</div>
                    <div className="font-mono text-[var(--color-text-muted)] text-[10px] break-all">
                      ID: {entry.errorId}
                    </div>
                    {entry.originalError && (
                      <div className="mt-1 text-[var(--color-text-muted)]">
                        {entry.originalError.message || String(entry.originalError)}
                      </div>
                    )}
                  </div>

                  {/* Retry button and result */}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry(entry.errorId);
                      }}
                      disabled={isRetrying}
                      className="text-xs px-2 py-1 bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {isRetrying ? "Retrying..." : "Retry"}
                    </button>
                    {retryResult && (
                      <span
                        className={`text-xs ${retryResult.success ? "text-green-400" : "text-red-400"}`}
                      >
                        {retryResult.message}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-muted)]">
          By operation:
          {Object.entries(stats.byOperation).map(([op, count]) => (
            <span
              key={op}
              className={`ml-2 cursor-pointer hover:text-[var(--color-text-secondary)] ${filterOperation === op ? "text-[var(--color-accent)]" : ""}`}
              onClick={() => setFilterOperation(op)}
            >
              {op}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
