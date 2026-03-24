/**
 * State snapshot — export/import system state (Story 46a.2).
 *
 * Pure functions. Assembles state from multiple sources into a
 * versioned snapshot, and validates snapshots for import.
 */

/** Current snapshot format version. */
export const SNAPSHOT_VERSION = 1;

/** Session metadata for export (no runtime handles). */
export interface SessionExport {
  sessionId: string;
  status: string;
  storyId?: string;
  projectId?: string;
  agentId?: string;
}

/** Full state snapshot. */
export interface StateSnapshot {
  version: number;
  exportedAt: string;
  sessions: SessionExport[];
  learnings: Record<string, unknown>[];
  sprintStatus: Record<string, unknown> | null;
  collaboration: {
    decisions: Record<string, unknown>[];
    claims: Record<string, unknown>[];
  } | null;
}

/** Validation result. */
export interface SnapshotValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Assemble a state snapshot from data sources.
 * Pure function — no I/O, no side effects.
 */
export function assembleSnapshot(data: {
  sessions: SessionExport[];
  learnings: Record<string, unknown>[];
  sprintStatus: Record<string, unknown> | null;
  collaboration: { decisions: Record<string, unknown>[]; claims: Record<string, unknown>[] } | null;
}): StateSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: data.sessions,
    learnings: data.learnings,
    sprintStatus: data.sprintStatus,
    collaboration: data.collaboration,
  };
}

/**
 * Validate a snapshot for import.
 * Pure function — checks structure and required fields.
 */
export function validateSnapshot(data: unknown): SnapshotValidation {
  const errors: string[] = [];

  if (data === null || typeof data !== "object") {
    return { valid: false, errors: ["Snapshot must be a JSON object"] };
  }

  const obj = data as Record<string, unknown>;

  // Version check
  if (obj.version !== SNAPSHOT_VERSION) {
    errors.push(`Unsupported version: ${String(obj.version)} (expected ${SNAPSHOT_VERSION})`);
  }

  // Required: exportedAt
  if (typeof obj.exportedAt !== "string") {
    errors.push("Missing or invalid exportedAt timestamp");
  } else if (isNaN(new Date(obj.exportedAt).getTime())) {
    errors.push("exportedAt is not a valid ISO 8601 timestamp");
  }

  // Required: sessions array
  if (!Array.isArray(obj.sessions)) {
    errors.push("Missing or invalid sessions array");
  }

  // Required: learnings array
  if (!Array.isArray(obj.learnings)) {
    errors.push("Missing or invalid learnings array");
  }

  // Optional: sprintStatus (plain object or null, not array)
  if (obj.sprintStatus !== null && obj.sprintStatus !== undefined) {
    if (typeof obj.sprintStatus !== "object" || Array.isArray(obj.sprintStatus)) {
      errors.push("sprintStatus must be an object or null");
    }
  }

  // Optional: collaboration (object or null)
  if (obj.collaboration !== null && obj.collaboration !== undefined) {
    if (typeof obj.collaboration !== "object") {
      errors.push("collaboration must be an object or null");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Merge imported learnings with existing (dedup by sessionId).
 * Returns only the new entries that should be added.
 */
export function mergeLearnings(
  existing: Array<{ sessionId: string }>,
  imported: Array<Record<string, unknown>>,
): Record<string, unknown>[] {
  const existingIds = new Set(existing.map((e) => e.sessionId));
  return imported.filter((entry) => {
    const id = typeof entry.sessionId === "string" ? entry.sessionId : null;
    return id !== null && !existingIds.has(id);
  });
}
