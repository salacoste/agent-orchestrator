/**
 * Resource Conflict Detection — types, pure functions, file store (Epic 52, Story 52.1).
 *
 * Detects when multiple projects target the same resources (repositories, file paths,
 * agents). Provides types, pure conflict detection functions, and file-based persistence.
 *
 * Design: Pure sync functions accepting pre-fetched data (same pattern as
 * cross-project-deps.ts, capacity-check.ts). File I/O in separate store adapter.
 *
 * FR-F4-1: Real-time conflict detection during story assignment.
 * FR-F4-2: Conflict analysis scales to 50 projects (O(n) hash map grouping).
 */

import type { OrchestratorConfig } from "./types.js";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse, stringify } from "yaml";
import { randomBytes } from "node:crypto";

// =============================================================================
// TYPES
// =============================================================================

/** Resource types that can conflict between projects. */
export type ResourceConflictType = "repository" | "file-path" | "agent" | "external-service";

/** Severity levels for detected resource conflicts. */
export type ResourceConflictSeverity = "critical" | "high" | "medium" | "low";

/** A resource used by a project, extracted from config. */
export interface ProjectResource {
  /** Project ID that uses this resource. */
  projectId: string;
  /** Type of the resource. */
  resourceType: ResourceConflictType;
  /** Resource identifier (e.g., repo URL, file path, agent ID). */
  resourceIdentifier: string;
}

/** A detected conflict between projects competing for the same resource. */
export interface ResourceConflict {
  /** Unique conflict ID. */
  id: string;
  /** What kind of resource is in conflict. */
  resourceType: ResourceConflictType;
  /** The contested resource (e.g., repo URL, file path, agent ID). */
  resourceIdentifier: string;
  /** Project IDs competing for this resource. */
  competingProjects: string[];
  /** Computed severity based on resource type and number of competitors. */
  severity: ResourceConflictSeverity;
  /** ISO timestamp when this conflict was detected. */
  detectedAt: string;
  /** Type-specific details. */
  metadata: Record<string, unknown>;
}

/** Result of a conflict detection scan. */
export interface ConflictDetectionResult {
  /** Detected conflicts. */
  conflicts: ResourceConflict[];
  /** How long the scan took in milliseconds. */
  scanDurationMs: number;
}

/** Store interface for resource conflict persistence. */
export interface ResourceConflictStore {
  /** Persist detected conflicts (overwrites previous). */
  save(conflicts: ResourceConflict[]): void;
  /** List stored conflicts, optionally filtered. */
  list(filter?: { resourceType?: ResourceConflictType; projectId?: string }): ResourceConflict[];
  /** Get conflicts from the most recent scan. */
  getActive(): ResourceConflict[];
  /** Clear all stored conflicts. */
  clear(): void;
}

/** YAML structure persisted to disk. */
interface ConflictFile {
  conflicts: ResourceConflict[];
  lastScanAt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default filename for the resource conflicts file. */
export const RESOURCE_CONFLICTS_FILENAME = "resource-conflicts.yaml";

/** Default filename for the JSONL audit trail (AC #6). */
export const RESOURCE_CONFLICTS_AUDIT_FILENAME = "resource-conflicts-audit.jsonl";

/** Valid resource conflict types for YAML validation. */
const VALID_CONFLICT_TYPES: ReadonlySet<string> = new Set<string>([
  "repository",
  "file-path",
  "agent",
  "external-service",
]);

/** Valid severity levels for YAML validation. */
const VALID_SEVERITIES: ReadonlySet<string> = new Set<string>([
  "critical",
  "high",
  "medium",
  "low",
]);

import {
  resolvePolicyForResource,
  applyPolicy,
  type PolicyResolutionResult,
} from "./conflict-policy.js";

/** Callbacks for conflict detection event emission (AC #6). */
export interface ConflictDetectionCallbacks {
  /** Called when one or more conflicts are detected. Story 52.2 adds SSE integration. */
  onConflictDetected?: (conflicts: ResourceConflict[]) => void;
  /** Called when a policy is auto-applied to a conflict (Story 52.4). */
  onPolicyApplied?: (result: PolicyResolutionResult) => void;
}

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a unique conflict ID.
 * Format: `conflict-<timestamp-base36>-<random-hex>` (same pattern as generateDepId).
 */
export function generateConflictId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString("hex").padStart(8, "0");
  return `conflict-${timestamp}-${random}`;
}

// =============================================================================
// PURE FUNCTIONS (no I/O — testable)
// =============================================================================

/**
 * Extract resources from an OrchestratorConfig.
 * For each project, extracts repository, file-path, and agent resources.
 *
 * @param config - Orchestrator configuration
 * @returns Array of project resources
 */
export function extractProjectResources(config: OrchestratorConfig): ProjectResource[] {
  const resources: ProjectResource[] = [];

  for (const [projectId, project] of Object.entries(config.projects)) {
    // Repository resource
    if (project.repo) {
      resources.push({
        projectId,
        resourceType: "repository",
        resourceIdentifier: project.repo,
      });
    }

    // File path resource (project path)
    if (project.path) {
      resources.push({
        projectId,
        resourceType: "file-path",
        resourceIdentifier: project.path,
      });
    }

    // Agent resource from shared pool (AC #2)
    // When shared pool is enabled and a resourcePool exists at config level,
    // the project competes for agents from the shared pool.
    if (project.sharedPool?.enabled && config.resourcePool) {
      resources.push({
        projectId,
        resourceType: "agent",
        resourceIdentifier: "shared-pool",
      });
    }
  }

  return resources;
}

/**
 * Compute conflict severity based on resource type and number of competing projects.
 *
 * Severity model:
 * - agent:       critical (always, agents are exclusive)
 * - repository:  high (base), critical if >2 projects
 * - file-path:   medium (base), high if >2 projects
 * - external-service: low (base), medium if >2 projects
 */
export function computeConflictSeverity(
  resourceType: ResourceConflictType,
  competingCount: number,
): ResourceConflictSeverity {
  if (competingCount > 2) {
    // Escalate all types when >2 projects compete
    if (resourceType === "agent") return "critical";
    if (resourceType === "repository") return "critical";
    if (resourceType === "file-path") return "high";
    return "medium";
  }

  // Base severity for exactly 2 competing projects
  switch (resourceType) {
    case "agent":
      return "critical";
    case "repository":
      return "high";
    case "file-path":
      return "medium";
    case "external-service":
      return "low";
  }
}

/**
 * Detect resource conflicts from a list of project resources.
 * Groups resources by (type, identifier), then creates conflicts for any group
 * with more than one project.
 *
 * Performance: O(n) where n is the number of resources (hash map grouping).
 *
 * @param resources - Flat list of project resources
 * @param now - Optional date override for testing
 * @returns Detected conflicts
 */
export function detectResourceConflicts(
  resources: ProjectResource[],
  now?: Date,
): ResourceConflict[] {
  if (resources.length === 0) return [];

  const detectedAt = (now ?? new Date()).toISOString();

  // Group by (resourceType, resourceIdentifier) → Set of project IDs
  const groups = new Map<
    string,
    { resourceType: ResourceConflictType; identifier: string; projects: Set<string> }
  >();

  for (const resource of resources) {
    const key = `${resource.resourceType}::${resource.resourceIdentifier}`;
    const existing = groups.get(key);
    if (existing) {
      existing.projects.add(resource.projectId);
    } else {
      groups.set(key, {
        resourceType: resource.resourceType,
        identifier: resource.resourceIdentifier,
        projects: new Set([resource.projectId]),
      });
    }
  }

  // Create conflicts for groups with >1 project
  const conflicts: ResourceConflict[] = [];
  for (const group of groups.values()) {
    if (group.projects.size <= 1) continue;

    const competingProjects = Array.from(group.projects);
    const severity = computeConflictSeverity(group.resourceType, competingProjects.length);

    conflicts.push({
      id: generateConflictId(),
      resourceType: group.resourceType,
      resourceIdentifier: group.identifier,
      competingProjects,
      severity,
      detectedAt,
      metadata: {
        competingCount: competingProjects.length,
      },
    });
  }

  return conflicts;
}

/**
 * Run a full conflict detection scan: extract resources from config, detect conflicts.
 * Returns result with timing information.
 *
 * @param config - Orchestrator configuration
 * @param now - Optional date override for testing
 * @returns Detection result with conflicts and scan duration
 */
export function runConflictDetection(
  config: OrchestratorConfig,
  now?: Date,
): ConflictDetectionResult {
  const start = performance.now();
  const resources = extractProjectResources(config);
  const conflicts = detectResourceConflicts(resources, now);
  const scanDurationMs = performance.now() - start;

  return { conflicts, scanDurationMs };
}

// =============================================================================
// FILE-BASED STORE IMPLEMENTATION
// =============================================================================

/**
 * File-based store for resource conflicts.
 * Persists to resource-conflicts.yaml alongside config.
 * Same pattern as CrossProjectDepFileStore.
 */
export class ResourceConflictFileStore implements ResourceConflictStore {
  readonly filePath: string;
  #cache: ConflictFile | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  save(conflicts: ResourceConflict[]): void {
    const data: ConflictFile = {
      conflicts,
      lastScanAt: new Date().toISOString(),
    };
    this.#cache = data;
    writeFileSync(this.filePath, stringify(data));
  }

  list(filter?: { resourceType?: ResourceConflictType; projectId?: string }): ResourceConflict[] {
    const data = this.#loadConflicts();
    if (!filter) return data.conflicts;

    return data.conflicts.filter((c) => {
      if (filter.resourceType && c.resourceType !== filter.resourceType) return false;
      if (filter.projectId && !c.competingProjects.includes(filter.projectId)) return false;
      return true;
    });
  }

  getActive(): ResourceConflict[] {
    return this.#loadConflicts().conflicts;
  }

  clear(): void {
    this.#cache = { conflicts: [], lastScanAt: new Date().toISOString() };
    writeFileSync(this.filePath, stringify(this.#cache));
  }

  #loadConflicts(): ConflictFile {
    if (this.#cache) return this.#cache;

    if (!existsSync(this.filePath)) {
      return { conflicts: [], lastScanAt: "" };
    }
    try {
      const content = readFileSync(this.filePath, "utf-8");
      const data = parse(content);
      if (!Array.isArray(data.conflicts))
        return { conflicts: [], lastScanAt: data.lastScanAt ?? "" };

      // Validate each entry has required fields
      const conflicts = data.conflicts.filter(
        (c: unknown): c is ResourceConflict =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as Record<string, unknown>).id === "string" &&
          typeof (c as Record<string, unknown>).resourceType === "string" &&
          VALID_CONFLICT_TYPES.has((c as Record<string, unknown>).resourceType as string) &&
          typeof (c as Record<string, unknown>).resourceIdentifier === "string" &&
          Array.isArray((c as Record<string, unknown>).competingProjects) &&
          typeof (c as Record<string, unknown>).severity === "string" &&
          VALID_SEVERITIES.has((c as Record<string, unknown>).severity as string) &&
          typeof (c as Record<string, unknown>).detectedAt === "string",
      );

      return { conflicts, lastScanAt: data.lastScanAt ?? "" };
    } catch {
      return { conflicts: [], lastScanAt: "" };
    }
  }
}

/**
 * Create a ResourceConflictFileStore from the config file path.
 * The conflicts file lives alongside the config file.
 */
export function createResourceConflictStore(configPath: string): ResourceConflictFileStore {
  const dir = dirname(configPath);
  return new ResourceConflictFileStore(join(dir, RESOURCE_CONFLICTS_FILENAME));
}

// =============================================================================
// JSONL AUDIT TRAIL (AC #6)
// =============================================================================

/**
 * Append a conflict detection scan result to the JSONL audit trail.
 * Each line is a JSON object with timestamp, conflict count, scan duration, and conflicts.
 * Persists to resource-conflicts-audit.jsonl alongside config.
 *
 * @param configPath - Path to the orchestrator config file
 * @param result - The detection result to audit
 */
export function appendConflictAudit(configPath: string, result: ConflictDetectionResult): void {
  const dir = dirname(configPath);
  const auditPath = join(dir, RESOURCE_CONFLICTS_AUDIT_FILENAME);
  const entry = {
    timestamp: new Date().toISOString(),
    conflictCount: result.conflicts.length,
    scanDurationMs: result.scanDurationMs,
    conflicts: result.conflicts,
  };
  appendFileSync(auditPath, JSON.stringify(entry) + "\n");
}

// =============================================================================
// HIGH-LEVEL INTEGRATION (AC #2, #6)
// =============================================================================

/**
 * High-level integration: run conflict detection + persist to store + audit trail.
 * Combines extractProjectResources → detectResourceConflicts → store.save → JSONL audit.
 *
 * This is the main entry point for the capacity/assignment flow (AC #2, #6).
 * Returns the detection result with conflicts and timing.
 *
 * @param config - Orchestrator configuration
 * @param store - Conflict store to persist results
 * @param now - Optional date override for testing
 * @param callbacks - Optional callbacks for event emission (AC #6, Story 52.2 adds SSE)
 */
export function checkResourceConflicts(
  config: OrchestratorConfig,
  store: ResourceConflictStore,
  now?: Date,
  callbacks?: ConflictDetectionCallbacks,
): ConflictDetectionResult {
  const result = runConflictDetection(config, now);
  store.save(result.conflicts);
  appendConflictAudit(config.configPath, result);

  // Event emission callback (AC #6 — Story 52.2 adds SSE-based real-time alerts)
  if (callbacks?.onConflictDetected && result.conflicts.length > 0) {
    callbacks.onConflictDetected(result.conflicts);
  }

  // Policy auto-resolution (Story 52.4 — apply configured policies to each conflict)
  for (const conflict of result.conflicts) {
    const policy = resolvePolicyForResource(conflict.resourceType, config);
    const resolution = applyPolicy(conflict, policy, config);
    // Track auto-resolution status on conflict metadata (Task 3.4)
    conflict.metadata.policyApplied = {
      actionTaken: resolution.actionTaken,
      resolutionMode: policy.resolutionMode,
    };
    if (resolution.actionTaken !== "none" && callbacks?.onPolicyApplied) {
      callbacks.onPolicyApplied(resolution);
    }
  }

  return result;
}
