/**
 * Configurable workflow columns — reads column definitions from project config
 * or falls back to default BMad columns.
 *
 * IMPORTANT: This module must NOT import from ./index.js (circular dependency).
 * It imports only from ./sprint-status-reader.js.
 */

import type { ProjectConfig } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkflowColumnDef {
  id: string;
  label: string;
  category: "open" | "active" | "done";
  color?: string;
}

export interface WorkflowColumns {
  all: readonly string[];
  definitions: readonly WorkflowColumnDef[];
  activeColumns: ReadonlySet<string>;
  doneColumn: string;
  openColumns: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Default columns
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS: readonly WorkflowColumnDef[] = [
  { id: "backlog", label: "Backlog", category: "open", color: "zinc-700" },
  { id: "ready-for-dev", label: "Ready", category: "open", color: "yellow-700" },
  { id: "in-progress", label: "In Progress", category: "active", color: "blue-700" },
  { id: "review", label: "Review", category: "active", color: "purple-700" },
  { id: "done", label: "Done", category: "done", color: "green-700" },
];

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Read workflow column definitions from project config, falling back to defaults.
 *
 * Config format:
 * ```yaml
 * tracker:
 *   plugin: bmad
 *   columns:
 *     - { id: backlog, label: Backlog, category: open }
 *     - { id: in-progress, label: In Progress, category: active }
 *     - { id: done, label: Done, category: done }
 * ```
 */
export function getWorkflowColumns(project: ProjectConfig): WorkflowColumns {
  const raw = project.tracker?.["columns"];
  const defs = parseColumnDefs(raw);

  const all = defs.map((d) => d.id);
  const activeColumns = new Set(defs.filter((d) => d.category === "active").map((d) => d.id));
  const openColumns = new Set(defs.filter((d) => d.category === "open").map((d) => d.id));
  const doneDef = defs.find((d) => d.category === "done");
  const doneColumn = doneDef?.id ?? "done";

  return { all, definitions: defs, activeColumns, doneColumn, openColumns };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** Get ordered column IDs. */
export function getColumns(project: ProjectConfig): readonly string[] {
  return getWorkflowColumns(project).all;
}

/** Get the set of active (in-progress) column IDs. */
export function getActiveColumns(project: ProjectConfig): ReadonlySet<string> {
  return getWorkflowColumns(project).activeColumns;
}

/** Get the done column ID. */
export function getDoneColumn(project: ProjectConfig): string {
  return getWorkflowColumns(project).doneColumn;
}

/** Get the display label for a column. */
export function getColumnLabel(project: ProjectConfig, columnId: string): string {
  const wf = getWorkflowColumns(project);
  const def = wf.definitions.find((d) => d.id === columnId);
  return def?.label ?? columnId;
}

/** Get the color for a column (e.g. "blue-700"). */
export function getColumnColor(project: ProjectConfig, columnId: string): string {
  const wf = getWorkflowColumns(project);
  const def = wf.definitions.find((d) => d.id === columnId);
  return def?.color ?? "zinc-700";
}

/** Check if a column ID is valid for this project's workflow. */
export function isValidColumn(project: ProjectConfig, columnId: string): boolean {
  return getWorkflowColumns(project).all.includes(columnId);
}

/**
 * Detect a backward transition (e.g. review -> in-progress).
 * Returns true if the target column index is less than the source column index.
 */
export function isBackwardTransition(project: ProjectConfig, from: string, to: string): boolean {
  const all = getWorkflowColumns(project).all;
  const fromIdx = all.indexOf(from);
  const toIdx = all.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx < fromIdx;
}

/**
 * Categorize a status using project config (config-aware version).
 * Falls back to the default column definitions if the status isn't found
 * in the project's configured columns.
 */
export function categorizeStatusFromConfig(
  project: ProjectConfig,
  status: string,
): "done" | "in-progress" | "open" {
  const wf = getWorkflowColumns(project);
  const def = wf.definitions.find((d) => d.id === status);
  if (def) {
    if (def.category === "done") return "done";
    if (def.category === "active") return "in-progress";
    return "open";
  }
  // Fallback for unknown statuses
  if (status === "done") return "done";
  if (status === "in-progress" || status === "review") return "in-progress";
  return "open";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseColumnDefs(raw: unknown): readonly WorkflowColumnDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_COLUMNS;

  const defs: WorkflowColumnDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : undefined;
    const label = typeof rec.label === "string" ? rec.label : id;
    const category = parseCategoryValue(rec.category);
    if (!id || !label) continue;
    const color = typeof rec.color === "string" ? rec.color : undefined;
    defs.push({ id, label, category, color });
  }

  if (defs.length === 0) return DEFAULT_COLUMNS;
  return defs;
}

function parseCategoryValue(val: unknown): "open" | "active" | "done" {
  if (val === "active") return "active";
  if (val === "done") return "done";
  return "open";
}
