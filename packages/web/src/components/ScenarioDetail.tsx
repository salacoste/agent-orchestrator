"use client";

/**
 * ScenarioDetail — client component for the scenario detail page (Story 54.2).
 *
 * Shows scenario header (name, status, date) and contains parameter editor,
 * story list, and diff summary sub-components.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WhatIfScenario, ScenarioParameters, StoryPriority, ParameterDiff } from "@/lib/types";
import type { SimulationResult } from "@composio/ao-core";
import {
  validateParameters,
  computeParameterDiff,
  applyParameterDefaults,
  MIN_AGENT_COUNT,
  MAX_AGENT_COUNT,
  MIN_CAPACITY,
  MAX_CAPACITY,
} from "@/lib/scenario-params";
import {
  statusBadgeColor,
  statusLabel,
  confidenceLabel,
  formatDate,
  relativeTime,
} from "@/lib/scenario-helpers";
import type { ScenarioRevision } from "@/lib/scenario-store";

interface ScenarioDetailProps {
  scenario: WhatIfScenario;
  /** Default agent count from config, used when scenario has no saved parameters. */
  defaultAgentCount?: number;
  /** Revision history for this scenario (Story 54.5). */
  revisions?: ScenarioRevision[];
}

function probabilityColor(p: number): string {
  if (p > 0.8) return "text-[var(--color-success)]";
  if (p >= 0.5) return "text-[var(--color-warning)]";
  return "text-[var(--color-error)]";
}

export function ScenarioDetail({
  scenario,
  defaultAgentCount = 1,
  revisions = [],
}: ScenarioDetailProps) {
  const router = useRouter();
  const isDraft = scenario.status === "draft";
  const isSimulated = scenario.status === "simulated";

  // Local parameter state (defaults from scenario or sensible defaults)
  const defaults = applyParameterDefaults(scenario.parameters, defaultAgentCount);
  const [agentCount, setAgentCount] = useState(defaults.agentCount);
  const [capacityLimit, setCapacityLimit] = useState(defaults.capacityLimit);
  const [storyPriorities, setStoryPriorities] = useState(
    scenario.parameters?.storyPriorities ?? [],
  );

  // Track the "saved" parameters baseline (updated on successful save)
  const [savedParams, setSavedParams] = useState<ScenarioParameters | undefined>(
    scenario.parameters,
  );

  // Track whether local edits differ from saved
  const currentParams: ScenarioParameters = { agentCount, capacityLimit, storyPriorities };
  const diff: ParameterDiff = computeParameterDiff(savedParams, currentParams);
  const hasUnsaved = diff.hasChanges;

  // Validation
  const storyIds = scenario.stories.map((s) => s.id);
  const validationErrors = validateParameters(currentParams, storyIds);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Simulation state (Story 54.3)
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(
    scenario.result ?? null,
  );

  // Apply state (Story 54.6)
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  // Unsaved changes warning
  useEffect(() => {
    if (!hasUnsaved) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsaved]);

  // Escape key to close confirmation dialog
  useEffect(() => {
    if (!showConfirmDialog) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowConfirmDialog(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmDialog]);

  // --- Handlers ---

  const handleAgentCountChange = useCallback((value: number) => {
    setAgentCount(Math.min(MAX_AGENT_COUNT, Math.max(MIN_AGENT_COUNT, value)));
  }, []);

  const handleCapacityChange = useCallback((value: number) => {
    setCapacityLimit(Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, value)));
  }, []);

  const handlePriorityChange = useCallback((storyId: string, newPriority: StoryPriority) => {
    setStoryPriorities((prev) => {
      const existing = prev.find((o) => o.storyId === storyId);
      if (existing) {
        if (newPriority === "medium") {
          // Remove override — back to default
          return prev.filter((o) => o.storyId !== storyId);
        }
        return prev.map((o) => (o.storyId === storyId ? { ...o, newPriority } : o));
      }
      if (newPriority === "medium") return prev;
      return [...prev, { storyId, originalPriority: "medium" as const, newPriority }];
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/scenarios/${scenario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: currentParams }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setSaveError(data.error ?? `Error ${response.status}`);
        return;
      }

      setSaveSuccess(true);
      // Update saved baseline so diff resets
      setSavedParams(currentParams);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save parameters");
    } finally {
      setSaving(false);
    }
  }

  const canSave = hasUnsaved && validationErrors.length === 0 && !saving && isDraft;

  async function handleSimulate() {
    setSimulating(true);
    setSimError(null);

    try {
      const response = await fetch(`/api/scenarios/${scenario.id}/simulate`, {
        method: "POST",
      });

      const data = (await response.json()) as
        | (SimulationResult & { color?: string })
        | { error?: string };

      if (!response.ok) {
        setSimError(("error" in data ? data.error : null) ?? `Error ${response.status}`);
        return;
      }

      // Success response — data is SimulationResult (error branch already returned)
      if ("p50Days" in data) {
        setSimulationResult(data);
      }
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    setApplyError(null);

    try {
      const response = await fetch(`/api/scenarios/${scenario.id}/apply`, {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setApplyError(data.error ?? `Error ${response.status}`);
        return;
      }

      setApplySuccess(true);
      setShowConfirmDialog(false);
      router.refresh();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/scenarios" className="text-sm text-[var(--color-accent)] hover:underline">
          &larr; Back to Scenarios
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{scenario.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Created {formatDate(scenario.createdAt)} &middot; {scenario.projectIds.length} project
            {scenario.projectIds.length !== 1 ? "s" : ""} &middot; {scenario.stories.length} stories
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeColor(scenario.status)}`}
        >
          {statusLabel(scenario.status)}
        </span>
      </div>

      {!isDraft && (
        <p className="mb-4 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-3 py-2 text-sm text-[var(--color-warning)]">
          Parameters cannot be edited — scenario has been {scenario.status}.
        </p>
      )}

      {/* Parameter Editor */}
      <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Parameters</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Agent Count */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
              Agent Count
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleAgentCountChange(agentCount - 1)}
                className="h-8 w-8 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                -
              </button>
              <input
                type="number"
                value={agentCount}
                readOnly={!isDraft}
                onChange={(e) => handleAgentCountChange(Number(e.target.value))}
                className="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1 text-center text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleAgentCountChange(agentCount + 1)}
                className="h-8 w-8 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Range: {MIN_AGENT_COUNT}–{MAX_AGENT_COUNT}
            </p>
          </div>

          {/* Capacity Limit */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
              Max Concurrent Stories per Agent
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleCapacityChange(capacityLimit - 1)}
                className="h-8 w-8 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                -
              </button>
              <input
                type="number"
                value={capacityLimit}
                readOnly={!isDraft}
                onChange={(e) => handleCapacityChange(Number(e.target.value))}
                className="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1 text-center text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <button
                type="button"
                disabled={!isDraft}
                onClick={() => handleCapacityChange(capacityLimit + 1)}
                className="h-8 w-8 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Range: {MIN_CAPACITY}–{MAX_CAPACITY}
            </p>
          </div>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mt-4 rounded-md border border-[var(--color-error)] bg-[var(--color-error)]/10 px-3 py-2">
            {validationErrors.map((err, i) => (
              <p key={i} className="text-sm text-[var(--color-error)]">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Save */}
        {isDraft && (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Parameters"}
            </button>
            {saveError && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {saveError}
              </p>
            )}
            {saveSuccess && <p className="text-sm text-[var(--color-success)]">Parameters saved</p>}
          </div>
        )}
      </div>

      {/* Story Priority List */}
      <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Story Priorities
        </h2>
        {scenario.stories.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No stories in this scenario.</p>
        ) : (
          <div className="space-y-2">
            {scenario.stories.map((story) => {
              const override = storyPriorities.find((o) => o.storyId === story.id);
              const priority: StoryPriority = override?.newPriority ?? "medium";

              return (
                <div
                  key={story.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <span className="flex-1 truncate text-sm text-[var(--color-text-primary)]">
                    {story.id}
                  </span>
                  <div className="flex gap-1">
                    {(["high", "medium", "low"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={!isDraft}
                        onClick={() => handlePriorityChange(story.id, p)}
                        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                          priority === p
                            ? p === "high"
                              ? "bg-[var(--color-error)]/15 text-[var(--color-error)]"
                              : p === "low"
                                ? "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]"
                                : "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                            : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Run Simulation (Story 54.3) */}
      {isDraft && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Simulation
          </h2>
          <button
            type="button"
            disabled={simulating || hasUnsaved || !scenario.parameters}
            onClick={handleSimulate}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {simulating ? "Simulating..." : "Run Simulation"}
          </button>
          {!scenario.parameters && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Save parameters before running simulation
            </p>
          )}
          {hasUnsaved && scenario.parameters && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Save parameter changes before simulating
            </p>
          )}
          {simError && (
            <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">
              {simError}
            </p>
          )}
        </div>
      )}

      {/* Simulation Results (Story 54.3) */}
      {simulationResult && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Simulation Results
          </h2>

          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-md border border-[var(--color-border)] p-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">50% Confidence</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
                {simulationResult.p50Days.toFixed(1)} days
              </p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">80% Confidence</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
                {simulationResult.p80Days.toFixed(1)} days
              </p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-3 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">95% Confidence</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
                {simulationResult.p95Days.toFixed(1)} days
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">On-Time Probability</p>
              <p
                className={`text-lg font-bold ${probabilityColor(simulationResult.onTimeProbability)}`}
              >
                {(simulationResult.onTimeProbability * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Confidence</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {confidenceLabel(simulationResult.confidence)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Iterations</p>
              <p className="text-sm text-[var(--color-text-primary)]">
                Based on {simulationResult.iterationsRun} simulations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Production (Story 54.6) */}
      {isSimulated && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Apply to Production
          </h2>
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            Apply this scenario&apos;s parameters to the real system. This action cannot be undone.
          </p>
          {scenario.parameters && (
            <div className="mb-3 rounded-md border border-[var(--color-border)] p-3 text-sm">
              <p className="text-[var(--color-text-secondary)]">
                Agent count:{" "}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {scenario.parameters.agentCount}
                </span>
                {" · "}Capacity:{" "}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {scenario.parameters.capacityLimit}
                </span>
              </p>
            </div>
          )}
          {applySuccess ? (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-[var(--color-success)]">
                Scenario applied successfully
              </p>
              <Link
                href="/scenarios"
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Back to Scenarios
              </Link>
            </div>
          ) : (
            <button
              type="button"
              disabled={applying}
              onClick={() => setShowConfirmDialog(true)}
              className="rounded-md bg-[var(--color-success)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply to Production
            </button>
          )}
          {applyError && (
            <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">
              {applyError}
            </p>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmDialog(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
            <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
              Confirm Apply
            </h3>
            <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
              Apply scenario <span className="font-medium">{scenario.name}</span> to production?
            </p>
            {scenario.parameters && (
              <div className="mb-4 rounded-md border border-[var(--color-border)] p-3 text-sm space-y-1">
                <p className="text-[var(--color-text-secondary)]">
                  Agent count:{" "}
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {scenario.parameters.agentCount}
                  </span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  Capacity limit:{" "}
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {scenario.parameters.capacityLimit}
                  </span>
                </p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={applying}
                onClick={handleApply}
                className="rounded-md bg-[var(--color-success)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {applying ? "Applying..." : "Confirm"}
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={() => setShowConfirmDialog(false)}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {applyError && (
              <p className="mt-3 text-sm text-[var(--color-error)]" role="alert">
                {applyError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Diff Summary */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Modification Summary
        </h2>
        {!diff.hasChanges ? (
          <p className="text-sm text-[var(--color-text-muted)]">No modifications</p>
        ) : (
          <div className="space-y-2 text-sm">
            {diff.agentCount && (
              <div className="text-[var(--color-text-primary)]">
                Agent count:{" "}
                <span className="text-[var(--color-text-muted)]">{diff.agentCount.original}</span>
                {" → "}
                <span
                  className={
                    diff.agentCount.modified > diff.agentCount.original
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-warning)]"
                  }
                >
                  {diff.agentCount.modified}
                </span>
              </div>
            )}
            {diff.capacityLimit && (
              <div className="text-[var(--color-text-primary)]">
                Capacity:{" "}
                <span className="text-[var(--color-text-muted)]">
                  {diff.capacityLimit.original}
                </span>
                {" → "}
                <span
                  className={
                    diff.capacityLimit.modified > diff.capacityLimit.original
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-warning)]"
                  }
                >
                  {diff.capacityLimit.modified}
                </span>
              </div>
            )}
            {diff.priorityChanges.length > 0 && (
              <div className="text-[var(--color-text-primary)]">
                {diff.priorityChanges.length} stories reprioritized
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revision History (Story 54.5 AC #4) */}
      <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">History</h2>
        {revisions.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No changes yet</p>
        ) : (
          <div className="space-y-3">
            {revisions.map((rev, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {relativeTime(rev.timestamp)}
                </span>
                <div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rev.action === "created"
                        ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                        : rev.action === "simulated" || rev.action === "applied"
                          ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                          : "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {rev.action}
                  </span>
                  {rev.changes.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {rev.changes.map((change, j) => (
                        <p key={j} className="text-xs text-[var(--color-text-muted)]">
                          <span className="font-medium text-[var(--color-text-secondary)]">
                            {change.field}
                          </span>
                          {change.previous !== null && change.previous !== undefined && (
                            <span> {String(change.previous)} → </span>
                          )}
                          <span>{String(change.current)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
