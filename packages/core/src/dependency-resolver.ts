/**
 * Dependency Resolver Service
 *
 * Handles event-driven dependency resolution for story unblocking.
 * When a story completes, checks if any dependent stories can be unblocked.
 * Supports diamond dependencies, circular dependency detection, and audit logging.
 */

import type { EventPublisher, EventBusEvent } from "./types.js";
import {
  findDependentStories,
  areDependenciesSatisfied,
  updateSprintStatus,
  logAuditEvent,
} from "./completion-handlers.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export interface DependencyResolverConfig {
  projectPath: string;
  auditDir: string;
  eventPublisher?: EventPublisher;
}

export interface DependencyResolverService {
  /** Handle a story.completed event and unblock dependent stories */
  onStoryCompleted(event: EventBusEvent): Promise<string[]>;
  /** Detect circular dependencies in story_dependencies */
  detectCycles(): string[][];
}

/**
 * Load sprint-status.yaml from project path
 */
function loadSprintStatus(projectPath: string): Record<string, unknown> | null {
  const statusPath = join(projectPath, "sprint-status.yaml");
  if (!existsSync(statusPath)) {
    return null;
  }
  try {
    const content = readFileSync(statusPath, "utf-8");
    return parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Detect circular dependencies using DFS.
 * Operates on story_dependencies from sprint-status.yaml.
 * Returns arrays of story IDs forming cycles.
 */
function detectDependencyCycles(storyDeps: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      // Found a cycle — extract the cycle from path
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = storyDeps[node];
    if (deps) {
      for (const dep of deps) {
        dfs(dep, [...path]);
      }
    }

    inStack.delete(node);
  }

  for (const node of Object.keys(storyDeps)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Create a DependencyResolverService instance.
 */
export function createDependencyResolver(
  config: DependencyResolverConfig,
): DependencyResolverService {
  const { projectPath, auditDir, eventPublisher } = config;

  return {
    async onStoryCompleted(event: EventBusEvent): Promise<string[]> {
      const completedStoryId = event.metadata.storyId as string | undefined;
      if (!completedStoryId) {
        return [];
      }

      // Log dependency check trigger
      logAuditEvent(auditDir, {
        timestamp: new Date().toISOString(),
        event_type: "dependency_check_triggered",
        agent_id: "",
        story_id: completedStoryId,
      });

      const newlyUnblocked: string[] = [];

      try {
        const sprintStatus = loadSprintStatus(projectPath);
        if (!sprintStatus) {
          return [];
        }

        // Check for circular dependencies first
        const storyDeps = (sprintStatus.story_dependencies ?? sprintStatus.dependencies) as
          | Record<string, string[]>
          | undefined;
        if (storyDeps) {
          const cycles = detectDependencyCycles(storyDeps);
          if (cycles.length > 0) {
            for (const cycle of cycles) {
              // eslint-disable-next-line no-console
              console.warn(
                `[dependency-resolver] Circular dependency detected: ${cycle.join(" → ")}`,
              );
              logAuditEvent(auditDir, {
                timestamp: new Date().toISOString(),
                event_type: "circular_dependency_detected",
                agent_id: "",
                story_id: completedStoryId,
                cycle: cycle.join(" → "),
              });
            }
            // Do NOT attempt to unblock stories in cycles
            // But still process non-cycled dependents
          }

          // Collect all story IDs that are part of any cycle
          const cycledStories = new Set<string>();
          for (const cycle of storyDeps ? detectDependencyCycles(storyDeps) : []) {
            for (const id of cycle) {
              cycledStories.add(id);
            }
          }

          // Find stories that depend on the completed story
          const dependents = findDependentStories(sprintStatus, completedStoryId);

          for (const storyId of dependents) {
            // Skip stories involved in circular dependencies
            if (cycledStories.has(storyId)) {
              continue;
            }

            try {
              if (areDependenciesSatisfied(storyId, sprintStatus)) {
                // All prerequisites met — unblock
                if (updateSprintStatus(projectPath, storyId, "ready-for-dev")) {
                  newlyUnblocked.push(storyId);

                  logAuditEvent(auditDir, {
                    timestamp: new Date().toISOString(),
                    event_type: "story_unblocked",
                    agent_id: "",
                    story_id: storyId,
                    unblocked_by: completedStoryId,
                  });

                  // Publish story.unblocked event
                  if (eventPublisher) {
                    try {
                      await eventPublisher.publishStoryUnblocked({
                        storyId,
                        unblockedBy: completedStoryId,
                        previousStatus: "blocked",
                        newStatus: "ready-for-dev",
                      });
                    } catch {
                      // Non-fatal: event publishing is an enhancement
                    }
                  }
                }
              } else {
                // Partial prerequisite — log which deps are still outstanding
                const deps = storyDeps?.[storyId] ?? [];
                const devStatus = sprintStatus.development_status as
                  | Record<string, string>
                  | undefined;
                const outstanding = deps.filter((depId) => devStatus?.[depId] !== "done");
                logAuditEvent(auditDir, {
                  timestamp: new Date().toISOString(),
                  event_type: "dependency_check_partial",
                  agent_id: "",
                  story_id: storyId,
                  completed_dep: completedStoryId,
                  outstanding_deps: outstanding,
                });
              }
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error(
                `[dependency-resolver] Failed to process dependent story ${storyId}:`,
                err,
              );
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[dependency-resolver] Dependency resolution failed for ${completedStoryId}:`,
          err,
        );
      }

      return newlyUnblocked;
    },

    detectCycles(): string[][] {
      const sprintStatus = loadSprintStatus(projectPath);
      if (!sprintStatus) {
        return [];
      }
      const storyDeps = (sprintStatus.story_dependencies ?? sprintStatus.dependencies) as
        | Record<string, string[]>
        | undefined;
      if (!storyDeps) {
        return [];
      }
      return detectDependencyCycles(storyDeps);
    },
  };
}
