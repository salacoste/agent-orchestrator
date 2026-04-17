"use client";

import { useState } from "react";
import type { WhatIfScenario, ScenarioProjectInfo } from "@/lib/types";

export type { ScenarioProjectInfo };

interface ScenarioCreatorProps {
  /** Available projects to select from. */
  projects: ScenarioProjectInfo[];
  /** Called when a scenario is successfully created. */
  onCreated: (scenario: WhatIfScenario) => void;
}

export function ScenarioCreator({ projects, onCreated }: ScenarioCreatorProps) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nameTouched, setNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = name.trim().length > 0;
  const projectsValid = selectedIds.size > 0;
  const canSubmit = nameValid && projectsValid && !submitting;

  function handleToggleProject(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(projects.map((p) => p.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameTouched(true);
    setError(null);

    if (!nameValid || !projectsValid) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          projectIds: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? `Error ${response.status}`);
        return;
      }

      const scenario = (await response.json()) as WhatIfScenario;
      onCreated(scenario);
      setName("");
      setSelectedIds(new Set());
      setNameTouched(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scenario");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
        Create New Scenario
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Name input */}
        <div className="mb-4">
          <label
            htmlFor="scenario-name"
            className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Scenario Name
          </label>
          <input
            id="scenario-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            aria-label="Scenario name"
            placeholder="e.g., Add 2 More Agents"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          {nameTouched && !nameValid && (
            <p className="mt-1 text-sm text-[var(--color-error)]">Scenario name is required</p>
          )}
        </div>

        {/* Project checkboxes */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              Select Projects
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
            {projects.map((project) => {
              const checked = selectedIds.has(project.id);
              return (
                <label
                  key={project.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--color-bg-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleProject(project.id)}
                    className="rounded border-[var(--color-border)]"
                  />
                  <span className="text-[var(--color-text-primary)]">{project.name}</span>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                    {project.storyCounts.total} stories: {project.storyCounts.done} done,{" "}
                    {project.storyCounts.inProgress} in-progress, {project.storyCounts.backlog}{" "}
                    backlog
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="mb-3 text-sm text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Scenario"}
        </button>
      </form>
    </div>
  );
}
