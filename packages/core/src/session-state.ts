/**
 * Session state reader — reads OMC execution state from a session's worktree.
 *
 * Reads metadata keys (omc:*) and .omc/state/*.json files to build a
 * SessionState snapshot for the dashboard. All file reads are best-effort:
 * missing files, malformed JSON, or absent metadata produce empty defaults.
 *
 * Epic 60, Story 60-7 (FR-D4-1, FR-D4-2).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionState, ActiveModeState } from "./types.js";

interface ModeFileMapping {
  file: string;
  mode: string;
}

const MODE_FILES: ModeFileMapping[] = [
  { file: "ralph-state.json", mode: "ralph" },
  { file: "ultrawork-state.json", mode: "ultrawork" },
  { file: "autopilot-state.json", mode: "autopilot" },
];

/** Best-effort JSON parse — returns fallback on failure or type mismatch. */
function safeParseJSON<T>(
  value: string | undefined,
  fallback: T,
  guard?: (v: unknown) => v is T,
): T {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    if (guard) return guard(parsed) ? parsed : fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Best-effort file read — returns null if missing or malformed. */
async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Map a parsed state file to an ActiveModeState. */
function parseActiveMode(mode: string, raw: Record<string, unknown>): ActiveModeState {
  const state: ActiveModeState = {
    mode,
    active: raw.active === true,
  };

  if (typeof raw.iteration === "number") state.iteration = raw.iteration;
  if (typeof raw.max_iterations === "number") state.maxIterations = raw.max_iterations;
  if (typeof raw.phase === "string") state.phase = raw.phase;

  // Autopilot-specific: tasks come from nested execution object
  const exec = raw.execution;
  if (exec && typeof exec === "object" && exec !== null) {
    const e = exec as Record<string, unknown>;
    if (typeof e.tasks_completed === "number") state.tasksCompleted = e.tasks_completed;
    if (typeof e.tasks_total === "number") state.tasksTotal = e.tasks_total;
  }

  return state;
}

/** Read all .omc/state/*.json files and return parsed ActiveModeState array. */
async function readModeStateFiles(stateDir: string): Promise<ActiveModeState[]> {
  const results = await Promise.all(
    MODE_FILES.map(async ({ file, mode }) => {
      const raw = await readJsonFile(join(stateDir, file));
      return raw ? parseActiveMode(mode, raw) : null;
    }),
  );
  return results.filter((r): r is ActiveModeState => r !== null);
}

/** Empty session state for sessions without a workspace. */
export function emptySessionState(): SessionState {
  return Object.freeze({
    executionMode: null,
    activeAgents: [],
    configured: false,
    activeModes: [],
    health: null,
  });
}

/**
 * Read the current execution state of a session from its worktree.
 *
 * @param worktreePath — absolute path to the session's worktree
 * @param metadata — session metadata record (flat key-value)
 * @returns SessionState snapshot
 */
export async function readSessionState(
  worktreePath: string,
  metadata: Record<string, string>,
): Promise<SessionState> {
  const executionMode = metadata["omc:executionMode"] ?? null;
  const activeAgents = safeParseJSON<string[]>(metadata["omc:agents"], [], (v): v is string[] =>
    Array.isArray(v),
  );
  const configured = metadata["omc:configured"] === "true";

  const activeModes = await readModeStateFiles(join(worktreePath, ".omc", "state"));

  return {
    executionMode,
    activeAgents,
    configured,
    activeModes,
    health: null, // Deferred — requires live provider instance
  };
}
