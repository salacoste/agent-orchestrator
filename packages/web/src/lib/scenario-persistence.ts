/**
 * File-based JSONL persistence for what-if scenarios (Story 54.5).
 *
 * Each mutation (create, update, delete) appends a JSONL event.
 * On init, events are replayed to rebuild the in-memory Map.
 * Corrupted lines are skipped (non-fatal).
 * Simple sequential writes with error suppression for tolerance.
 */

import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
// proper-lockfile not used by collaboration-store — not imported here to avoid dependency issues.
// Instead, simple sequential writes with error suppression for corrupted files tolerance.
import type { WhatIfScenario } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single revision/change entry for a scenario. */
export interface ScenarioRevision {
  scenarioId: string;
  timestamp: string;
  action: "created" | "updated" | "simulated" | "applied" | "deleted";
  changes: {
    field: string;
    previous?: unknown;
    current: unknown;
  }[];
}

/** JSONL event shape stored on disk. */
interface ScenarioEvent {
  action: "created" | "updated" | "simulated" | "applied" | "deleted";
  timestamp: string;
  scenario: WhatIfScenario;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let dataDir: string | null = null;
const store = new Map<string, WhatIfScenario>();
const revisions = new Map<string, ScenarioRevision[]>();
let loaded = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize persistence — load events from disk, replay to rebuild Map.
 * @param dir — directory for JSONL files (default: `$cwd/.ao-scenarios`)
 */
export async function initPersistence(dir?: string): Promise<void> {
  dataDir = dir ?? join(process.cwd(), ".ao-scenarios");
  store.clear();
  revisions.clear();
  loaded = false;

  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
    loaded = true;
    return;
  }

  const filePath = join(dataDir, "scenarios.jsonl");
  const events = await loadJsonlRaw<ScenarioEvent>(filePath);

  for (const event of events) {
    if (!isValidScenarioEvent(event)) continue;

    if (event.action === "deleted") {
      store.delete(event.scenario.id);
    } else {
      // "created" or "updated" — set/overwrite in Map
      store.set(event.scenario.id, event.scenario);
    }
  }

  loaded = true;
}

/** Ensure persistence is initialized (lazy init on first call). */
async function ensureInit(): Promise<void> {
  if (loaded) return;
  await initPersistence();
}

// ---------------------------------------------------------------------------
// Public API (same shape as old in-memory store)
// ---------------------------------------------------------------------------

/** List all stored scenarios, sorted by updatedAt (newest first), then createdAt. */
export async function listScenarios(): Promise<WhatIfScenario[]> {
  await ensureInit();
  return Array.from(store.values()).sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt;
    const bTime = b.updatedAt ?? b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

/** Get a single scenario by ID. */
export async function getScenario(id: string): Promise<WhatIfScenario | undefined> {
  await ensureInit();
  return store.get(id);
}

/** Add a scenario and persist to disk. */
export async function addScenario(scenario: WhatIfScenario): Promise<void> {
  await ensureInit();
  const now = new Date().toISOString();
  const withTimestamp = { ...scenario, updatedAt: now };
  store.set(scenario.id, withTimestamp);

  await appendEvent({
    action: "created",
    timestamp: now,
    scenario: withTimestamp,
  });

  addRevisionEntry(scenario.id, {
    scenarioId: scenario.id,
    timestamp: now,
    action: "created",
    changes: [{ field: "status", previous: null, current: scenario.status }],
  });
}

/**
 * Update a scenario by merging partial data.
 * Returns the updated scenario, or undefined if not found.
 */
export async function updateScenario(
  id: string,
  partial: Partial<WhatIfScenario>,
): Promise<WhatIfScenario | undefined> {
  await ensureInit();
  const existing = store.get(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const updated: WhatIfScenario = { ...existing, ...partial, id: existing.id, updatedAt: now };
  store.set(id, updated);

  // Build revision entry with changes
  const changes: ScenarioRevision["changes"] = [];
  for (const [key, value] of Object.entries(partial)) {
    if (key === "id") continue;
    changes.push({
      field: key,
      previous: (existing as unknown as Record<string, unknown>)[key],
      current: value,
    });
  }

  const action: ScenarioRevision["action"] =
    partial.status === "simulated"
      ? "simulated"
      : partial.status === "applied"
        ? "applied"
        : "updated";

  await appendEvent({
    action,
    timestamp: now,
    scenario: updated,
  });

  if (changes.length > 0) {
    addRevisionEntry(id, { scenarioId: id, timestamp: now, action, changes });
  }

  return updated;
}

/** Delete a scenario by ID. Returns true if found and deleted. */
export async function deleteScenario(id: string): Promise<boolean> {
  await ensureInit();
  const existing = store.get(id);
  if (!existing) return false;

  const now = new Date().toISOString();
  store.delete(id);
  revisions.delete(id);

  await appendEvent({
    action: "deleted",
    timestamp: now,
    scenario: existing,
  });

  return true;
}

/** Clear all scenarios (testing utility). */
export async function clearScenarios(): Promise<void> {
  await ensureInit();
  store.clear();
  revisions.clear();

  if (dataDir) {
    const filePath = join(dataDir, "scenarios.jsonl");
    try {
      if (existsSync(filePath)) {
        await writeFile(filePath, "", "utf-8");
      }
    } catch {
      // Non-fatal — tests may not have a real filesystem
    }
  }
}

// ---------------------------------------------------------------------------
// Revision history
// ---------------------------------------------------------------------------

/** Get revision history for a scenario. */
export async function getRevisions(scenarioId: string): Promise<ScenarioRevision[]> {
  await ensureInit();
  return revisions.get(scenarioId) ?? [];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Add a revision entry to the in-memory map. */
function addRevisionEntry(scenarioId: string, revision: ScenarioRevision): void {
  const existing = revisions.get(scenarioId) ?? [];
  existing.push(revision);
  revisions.set(scenarioId, existing);
}

/** Append a JSONL event to disk (simple sequential writes). */
async function appendEvent(event: ScenarioEvent): Promise<void> {
  if (!dataDir) return;

  try {
    await mkdir(dataDir, { recursive: true });
    const filePath = join(dataDir, "scenarios.jsonl");
    await appendFile(filePath, JSON.stringify(event) + "\n", "utf-8");
  } catch {
    // Persistence errors are non-fatal — data remains in memory
  }
}

/** Load raw JSON objects from a JSONL file, skipping malformed lines. */
async function loadJsonlRaw<T>(path: string): Promise<T[]> {
  if (!existsSync(path)) return [];

  try {
    const content = await readFile(path, "utf-8");
    const entries: T[] = [];

    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as T);
      } catch {
        // Skip corrupted lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/** Shape guard for ScenarioEvent. */
function isValidScenarioEvent(obj: unknown): obj is ScenarioEvent {
  if (!obj || typeof obj !== "object") return false;
  const e = obj as Record<string, unknown>;
  if (typeof e.action !== "string") return false;
  if (typeof e.timestamp !== "string") return false;
  if (!e.scenario || typeof e.scenario !== "object") return false;
  const s = e.scenario as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.name === "string";
}

/** Reset internal state (for testing). Sets loaded=true to prevent lazy init from reading disk. */
export function _resetForTesting(): void {
  dataDir = null;
  store.clear();
  revisions.clear();
  loaded = true;
}
