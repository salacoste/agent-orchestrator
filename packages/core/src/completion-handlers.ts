/**
 * Completion Handlers — Handle agent completion and failure events
 *
 * These handlers are called when an agent completes or fails.
 * They update the agent registry, sprint status, and trigger notifications.
 */

import type {
  AgentRegistry,
  Notifier,
  OrchestratorEvent,
  CompletionEvent,
  FailureEvent,
  CompletionHandler,
  FailureHandler,
} from "./types.js";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";

/**
 * Log an event to the JSONL audit trail
 */
export function logAuditEvent(
  auditDir: string,
  event: {
    timestamp: string;
    event_type: string;
    agent_id: string;
    story_id: string;
    [key: string]: unknown;
  },
): void {
  try {
    // Ensure audit directory exists
    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }

    const auditFile = join(auditDir, "agent-lifecycle.jsonl");
    const line = JSON.stringify(event);
    writeFileSync(auditFile, line + "\n", { flag: "a" });
  } catch (err) {
    // Non-fatal: logging failure should not block completion handling
    // eslint-disable-next-line no-console
    console.error("Failed to write audit log:", err);
  }
}

/**
 * Load sprint-status.yaml
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
 * Update story status in sprint-status.yaml atomically
 */
export function updateSprintStatus(
  projectPath: string,
  storyId: string,
  newStatus: string,
): boolean {
  const statusPath = join(projectPath, "sprint-status.yaml");
  const tmpPath = statusPath + ".tmp";

  try {
    // Read current status
    const content = readFileSync(statusPath, "utf-8");
    const status = parse(content) as { development_status: Record<string, string> };

    // Update story status
    if (!status.development_status) {
      return false;
    }

    status.development_status[storyId] = newStatus;

    // Validate YAML syntax
    const newYaml = stringify(status);

    // Write to temporary file
    writeFileSync(tmpPath, newYaml, "utf-8");

    // Atomic rename (overwrites original)
    renameSync(tmpPath, statusPath);

    return true;
  } catch (err) {
    // Clean up temp file on error
    try {
      unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    // eslint-disable-next-line no-console
    console.error(`Failed to update sprint status for ${storyId}:`, err);
    return false;
  }
}

/**
 * Find all stories that depend on a given story
 */
function findDependentStories(
  sprintStatus: Record<string, unknown>,
  completedStoryId: string,
): string[] {
  const deps = sprintStatus.dependencies as Record<string, string[]> | undefined;
  if (!deps) {
    return [];
  }

  const dependents: string[] = [];
  for (const [storyId, storyDeps] of Object.entries(deps)) {
    if (storyDeps.includes(completedStoryId)) {
      dependents.push(storyId);
    }
  }

  return dependents;
}

/**
 * Check if all dependencies for a story are satisfied
 */
function areDependenciesSatisfied(storyId: string, sprintStatus: Record<string, unknown>): boolean {
  const deps = sprintStatus.dependencies as Record<string, string[]> | undefined;
  if (!deps) {
    return true; // No dependencies
  }

  const storyDeps = deps[storyId];
  if (!storyDeps || storyDeps.length === 0) {
    return true;
  }

  const devStatus = sprintStatus.development_status as Record<string, string> | undefined;
  if (!devStatus) {
    return false;
  }

  // All dependencies must be "done"
  return storyDeps.every((depId) => devStatus[depId] === "done");
}

/**
 * Unblock stories that were waiting on the completed story
 */
async function unblockDependentStories(
  projectPath: string,
  completedStoryId: string,
  auditDir: string,
  notifier?: Notifier,
): Promise<string[]> {
  const sprintStatus = loadSprintStatus(projectPath);
  if (!sprintStatus) {
    return [];
  }

  const newlyUnblocked: string[] = [];
  const dependents = findDependentStories(sprintStatus, completedStoryId);

  for (const storyId of dependents) {
    if (areDependenciesSatisfied(storyId, sprintStatus)) {
      // Update status to ready-for-dev
      if (updateSprintStatus(projectPath, storyId, "ready-for-dev")) {
        newlyUnblocked.push(storyId);

        // Log unblocking event
        logAuditEvent(auditDir, {
          timestamp: new Date().toISOString(),
          event_type: "story_unblocked",
          agent_id: "",
          story_id: storyId,
          unblocked_by: completedStoryId,
        });
      }
    }
  }

  // Send notification if stories were unblocked
  if (notifier && newlyUnblocked.length > 0) {
    const message =
      `${newlyUnblocked.length} storie${newlyUnblocked.length === 1 ? "y" : "s"} ready for development:\n` +
      newlyUnblocked.map((id) => `  • ${id}`).join("\n");

    await notifier.notify({
      id: `unblock-${completedStoryId}-${Date.now()}`,
      type: "tracker.story_done",
      priority: "info",
      sessionId: "", // No specific session
      projectId: "",
      timestamp: new Date(),
      message,
      data: { unblocked_stories: newlyUnblocked },
    } satisfies OrchestratorEvent);
  }

  return newlyUnblocked;
}

/**
 * Create a completion handler
 */
export function createCompletionHandler(
  registry: AgentRegistry,
  projectPath: string,
  auditDir: string,
  notifier?: Notifier,
): CompletionHandler {
  return async (event: CompletionEvent) => {
    // Update agent status in registry
    const assignment = registry.getByAgent(event.agentId);
    if (assignment) {
      // Remove from registry (agent completed)
      registry.remove(event.agentId);
    }

    // Update story status to "done"
    updateSprintStatus(projectPath, event.storyId, "done");

    // Log completion event
    logAuditEvent(auditDir, {
      timestamp: event.completedAt.toISOString(),
      event_type: "agent_completed",
      agent_id: event.agentId,
      story_id: event.storyId,
      exit_code: event.exitCode,
      duration_ms: event.duration,
    });

    // Unblock dependent stories
    await unblockDependentStories(projectPath, event.storyId, auditDir, notifier);
  };
}

/**
 * Create a failure handler
 */
export function createFailureHandler(
  registry: AgentRegistry,
  projectPath: string,
  auditDir: string,
  notifier?: Notifier,
): FailureHandler {
  return async (event: FailureEvent) => {
    // Update agent status in registry
    const assignment = registry.getByAgent(event.agentId);
    if (assignment) {
      // Mark as failed/disconnected/etc and remove from active monitoring
      registry.remove(event.agentId);
    }

    // Update story status to "blocked" (except for manual termination)
    if (event.reason !== "disconnected") {
      updateSprintStatus(projectPath, event.storyId, "blocked");
    }

    // Log failure event
    logAuditEvent(auditDir, {
      timestamp: event.failedAt.toISOString(),
      event_type: "agent_failed",
      agent_id: event.agentId,
      story_id: event.storyId,
      reason: event.reason,
      exit_code: event.exitCode,
      signal: event.signal,
      duration_ms: event.duration,
    });

    // Send notification for failures (but not manual termination)
    if (notifier && event.reason !== "disconnected") {
      const reasonText =
        {
          failed: "failed",
          crashed: "crashed",
          timed_out: "timed out",
        }[event.reason] || event.reason;

      await notifier.notify({
        id: `failure-${event.agentId}-${Date.now()}`,
        type: "session.errored",
        priority: event.reason === "crashed" ? "urgent" : "action",
        sessionId: event.agentId,
        projectId: "",
        timestamp: event.failedAt,
        message: `Agent ${event.agentId} ${reasonText} for ${event.storyId}. Run 'ao resume ${event.storyId}' to investigate.`,
        data: {
          agent_id: event.agentId,
          story_id: event.storyId,
          reason: event.reason,
          exit_code: event.exitCode,
        },
      } satisfies OrchestratorEvent);
    }
  };
}

/**
 * Format failure reason for display
 */
export function formatFailureReason(reason: FailureEvent["reason"]): string {
  const reasons: Record<FailureEvent["reason"], string> = {
    failed: "failed with non-zero exit code",
    crashed: "crashed",
    timed_out: "timed out",
    disconnected: "was disconnected (manual termination)",
  };
  return reasons[reason] || reason;
}
