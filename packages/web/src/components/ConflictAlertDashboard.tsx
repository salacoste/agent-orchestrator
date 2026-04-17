"use client";

import { useState, useCallback, useMemo } from "react";
import type { ResourceConflict } from "@composio/ao-core";
import { useConflictSSE } from "@/hooks/useConflictSSE";
import { ConflictSummaryCards } from "./ConflictSummaryCards";
import { ConflictListView } from "./ConflictListView";
import { ConflictDetailPanel } from "./ConflictDetailPanel";

interface ConflictAlertDashboardProps {
  initialConflicts: ResourceConflict[];
  scanDurationMs: number;
}

export function ConflictAlertDashboard({
  initialConflicts,
  scanDurationMs,
}: ConflictAlertDashboardProps) {
  const [conflicts, setConflicts] = useState<ResourceConflict[]>(initialConflicts);
  const [selectedConflictId, setSelectedConflictId] = useState<string | undefined>();
  const [newConflictIds, setNewConflictIds] = useState<Set<string>>(new Set());

  // SSE callback for new conflicts
  const handleConflictDetected = useCallback((incoming: ResourceConflict[]) => {
    setConflicts((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const trulyNew = incoming.filter((c) => !existingIds.has(c.id));
      if (trulyNew.length === 0) return prev;
      return [...prev, ...trulyNew];
    });

    // Track new IDs for "New" badge (outside setConflicts updater to avoid nested setState)
    setNewConflictIds((prevIds) => {
      const next = new Set(prevIds);
      for (const c of incoming) {
        next.add(c.id);
      }
      return next;
    });
  }, []);

  // Subscribe to conflict SSE events
  useConflictSSE(handleConflictDetected);

  // Find selected conflict object
  const selectedConflict = useMemo(
    () => conflicts.find((c) => c.id === selectedConflictId),
    [conflicts, selectedConflictId],
  );

  const handleSelectConflict = useCallback((conflict: ResourceConflict) => {
    setSelectedConflictId(conflict.id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedConflictId(undefined);
  }, []);

  return (
    <div className="px-8 py-7">
      <section aria-label="Conflict Alert Dashboard">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Resource Conflicts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Detected conflicts across projects
            {scanDurationMs > 0 ? ` (scan: ${scanDurationMs.toFixed(0)}ms)` : ""}
          </p>
        </div>

        {/* Summary cards */}
        <ConflictSummaryCards conflicts={conflicts} />

        {/* Conflict list with filters */}
        <ConflictListView
          conflicts={conflicts}
          onSelectConflict={handleSelectConflict}
          selectedConflictId={selectedConflictId}
          newConflictIds={newConflictIds}
        />

        {/* Detail panel (slide-over) */}
        {selectedConflict && (
          <ConflictDetailPanel conflict={selectedConflict} onClose={handleCloseDetail} />
        )}
      </section>
    </div>
  );
}
