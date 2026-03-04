/**
 * Story dependency graph — detects blockers, cycles, and missing references.
 *
 * Reads `dependsOn` arrays from sprint-status.yaml entries and builds
 * a dependency graph with cycle detection via DFS.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus } from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DependencyNode {
  storyId: string;
  dependsOn: string[];
  blockedBy: string[];
  blocks: string[];
  isBlocked: boolean;
}

export interface DependencyGraph {
  nodes: Record<string, DependencyNode>;
  circularWarnings: string[][];
  missingWarnings: string[];
}

export interface DependencyValidation {
  blocked: boolean;
  blockers: Array<{ id: string; status: string }>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract dependsOn as a string array from a sprint status entry.
 * Handles missing, non-array, and mixed-type values gracefully.
 */
function parseDependsOn(entry: Record<string, unknown>): string[] {
  const raw = entry["dependsOn"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

/**
 * Detect circular dependencies via recursive DFS.
 * Returns arrays of story IDs forming cycles (deduplicated by canonical form).
 */
function detectCycles(nodes: Record<string, DependencyNode>): string[][] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];
  const seen = new Set<string>();

  function dfs(id: string, path: string[]): void {
    if (visited.has(id)) return;

    visited.add(id);
    inStack.add(id);
    const newPath = [...path, id];

    const node = nodes[id];
    if (node) {
      for (const dep of node.dependsOn) {
        if (!nodes[dep]) continue;

        if (inStack.has(dep)) {
          // Back edge — cycle found
          const cycleStart = newPath.indexOf(dep);
          if (cycleStart >= 0) {
            const cycle = newPath.slice(cycleStart);
            const canonical = canonicalizeCycle(cycle);
            const key = canonical.join(",");
            if (!seen.has(key)) {
              seen.add(key);
              cycles.push(canonical);
            }
          }
        } else if (!visited.has(dep)) {
          dfs(dep, newPath);
        }
      }
    }

    inStack.delete(id);
  }

  for (const startId of Object.keys(nodes)) {
    if (!visited.has(startId)) {
      dfs(startId, []);
    }
  }

  return cycles;
}

function canonicalizeCycle(cycle: string[]): string[] {
  if (cycle.length === 0) return cycle;
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i]! < cycle[minIdx]!) minIdx = i;
  }
  return [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

export function computeDependencyGraph(project: ProjectConfig): DependencyGraph {
  let entries: Record<string, Record<string, unknown>>;
  try {
    const sprint = readSprintStatus(project);
    entries = sprint.development_status;
  } catch {
    return { nodes: {}, circularWarnings: [], missingWarnings: [] };
  }

  const allIds = new Set(Object.keys(entries));
  const nodes: Record<string, DependencyNode> = {};
  const missingWarnings: string[] = [];
  const missingSet = new Set<string>();

  // First pass: build nodes with dependsOn
  for (const [id, entry] of Object.entries(entries)) {
    const dependsOn = parseDependsOn(entry);

    // Check for missing references
    for (const dep of dependsOn) {
      if (!allIds.has(dep) && !missingSet.has(dep)) {
        missingSet.add(dep);
        missingWarnings.push(dep);
      }
    }

    nodes[id] = {
      storyId: id,
      dependsOn,
      blockedBy: [],
      blocks: [],
      isBlocked: false,
    };
  }

  // Second pass: compute blockedBy (deps not done) and reverse blocks
  for (const [id, node] of Object.entries(nodes)) {
    for (const depId of node.dependsOn) {
      const depEntry = entries[depId];
      if (!depEntry) continue; // missing ref — already warned

      const depStatus = typeof depEntry["status"] === "string" ? depEntry["status"] : "backlog";

      if (depStatus !== "done") {
        node.blockedBy.push(depId);
      }

      // Reverse link
      const depNode = nodes[depId];
      if (depNode) {
        depNode.blocks.push(id);
      }
    }

    node.isBlocked = node.blockedBy.length > 0;
  }

  // Detect cycles
  const circularWarnings = detectCycles(nodes);

  return { nodes, circularWarnings, missingWarnings };
}

export function validateDependencies(
  storyId: string,
  project: ProjectConfig,
): DependencyValidation {
  const warnings: string[] = [];

  let entries: Record<string, Record<string, unknown>>;
  try {
    const sprint = readSprintStatus(project);
    entries = sprint.development_status;
  } catch {
    return { blocked: false, blockers: [], warnings: [] };
  }

  const entry = entries[storyId];
  if (!entry) {
    return { blocked: false, blockers: [], warnings: [] };
  }

  const dependsOn = parseDependsOn(entry);
  if (dependsOn.length === 0) {
    return { blocked: false, blockers: [], warnings: [] };
  }

  const blockers: Array<{ id: string; status: string }> = [];

  for (const depId of dependsOn) {
    const depEntry = entries[depId];
    if (!depEntry) {
      warnings.push(`Dependency '${depId}' not found in sprint`);
      continue;
    }

    const status = typeof depEntry["status"] === "string" ? depEntry["status"] : "backlog";

    if (status !== "done") {
      blockers.push({ id: depId, status });
    }
  }

  return {
    blocked: blockers.length > 0,
    blockers,
    warnings,
  };
}

export function getStoryDependencies(
  storyId: string,
  project: ProjectConfig,
): DependencyNode | null {
  const graph = computeDependencyGraph(project);
  return graph.nodes[storyId] ?? null;
}
