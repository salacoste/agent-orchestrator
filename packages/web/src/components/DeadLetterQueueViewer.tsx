"use client";

import { useState, useEffect, useCallback } from "react";
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

  const fetchData = useCallback(() => {
    setLoading(true);
    // TODO: Pass projectId to API for project-specific DLQ paths when config loading is available
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
  }, []);

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

  const { stats, entries } = data;

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

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {entries.map((entry) => {
          const isExpanded = expanded.has(entry.errorId);
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
            <span key={op} className="ml-2">
              {op}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
