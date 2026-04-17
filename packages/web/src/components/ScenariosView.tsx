"use client";

import { useState, useCallback, useMemo } from "react";
import type { WhatIfScenario, ScenarioProjectInfo } from "@/lib/types";
import { ScenarioCreator } from "./ScenarioCreator";
import { ScenarioCard } from "./ScenarioCard";

interface ScenariosViewProps {
  projects: ScenarioProjectInfo[];
  initialScenarios: WhatIfScenario[];
}

export function ScenariosView({ projects, initialScenarios }: ScenariosViewProps) {
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>(initialScenarios);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hasSimulatedScenarios = useMemo(
    () => scenarios.some((s) => s.status === "simulated" || s.status === "applied"),
    [scenarios],
  );

  const selectedSimulatedCount = useMemo(
    () =>
      scenarios.filter(
        (s) => selectedIds.has(s.id) && (s.status === "simulated" || s.status === "applied"),
      ).length,
    [scenarios, selectedIds],
  );

  const canCompare = selectedSimulatedCount >= 2 && selectedSimulatedCount <= 4;

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    const ids = Array.from(selectedIds).map(encodeURIComponent).join(",");
    window.location.href = `/scenarios/compare?ids=${ids}`;
  }, [selectedIds]);

  const handleCreated = useCallback((scenario: WhatIfScenario) => {
    setScenarios((prev) => [scenario, ...prev]);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
      if (response.ok) {
        setScenarios((prev) => prev.filter((s) => s.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setDeleteError(null);
      } else {
        const data = await response.json().catch(() => null);
        setDeleteError(data?.error ?? `Failed to delete scenario (${response.status})`);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete scenario");
    }
  }, []);

  const handleOpen = useCallback((id: string) => {
    // Navigation to scenario detail page — implemented in 54.2
    window.location.href = `/scenarios/${id}`;
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">What-If Scenarios</h1>

      {/* Creator form */}
      <ScenarioCreator projects={projects} onCreated={handleCreated} />

      {/* Delete error feedback */}
      {deleteError && (
        <p
          className="rounded-md border border-[var(--color-error)] bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]"
          role="alert"
        >
          {deleteError}
        </p>
      )}

      {/* Compare toolbar — visible when simulated scenarios exist */}
      {hasSimulatedScenarios && scenarios.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canCompare}
            onClick={handleCompare}
            className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Compare Selected ({selectedSimulatedCount})
          </button>
          {selectedSimulatedCount > 0 && selectedSimulatedCount < 2 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Select at least 2 simulated scenarios to compare
            </span>
          )}
        </div>
      )}

      {/* Scenario grid or empty state */}
      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No scenarios yet. Create your first scenario above to start experimenting.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onOpen={handleOpen}
              onDelete={handleDelete}
              selectable={hasSimulatedScenarios}
              selected={selectedIds.has(scenario.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
