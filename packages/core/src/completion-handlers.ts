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
  StateManager,
  StoryStatus,
  EventPublisher,
} from "./types.js";
import { captureSessionLearning } from "./session-learning.js";
import { getLearningStore } from "./service-registry.js";
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
import { updateMetadata, getSessionsDir, type SessionId } from "./metadata.js";
import { captureTmuxSessionLogs, getLogFilePath, storeLogPathInMetadata } from "./log-capture.js";

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
 * Update story status in sprint-status.yaml.
 *
 * When a StateManager is provided, uses stateManager.update() for write-through
 * caching with version conflict detection. Falls back to direct YAML write when
 * StateManager is unavailable or on StateManager error (graceful degradation).
 */
export function updateSprintStatus(
  projectPath: string,
  storyId: string,
  newStatus: string,
  stateManager?: StateManager,
): boolean {
  // Try StateManager path first (if provided)
  if (stateManager) {
    try {
      const currentVersion = stateManager.getVersion(storyId);
      const updatePromise = stateManager.update(
        storyId,
        { status: newStatus as StoryStatus },
        currentVersion ?? undefined,
      );

      // Handle async result — fire and forget with conflict retry
      updatePromise
        .then((result) => {
          if (result.conflict) {
            // Retry once with fresh version
            const freshVersion = stateManager.getVersion(storyId);
            return stateManager.update(
              storyId,
              { status: newStatus as StoryStatus },
              freshVersion ?? undefined,
            );
          }
          return result;
        })
        .catch((err) => {
          // StateManager failed — fall back to direct YAML write
          // eslint-disable-next-line no-console
          console.warn(
            `[completion-handlers] StateManager update failed for ${storyId}, falling back to direct YAML:`,
            err,
          );
          directYamlUpdate(projectPath, storyId, newStatus);
        });

      return true;
    } catch {
      // StateManager threw synchronously — fall back to direct YAML write
    }
  }

  return directYamlUpdate(projectPath, storyId, newStatus);
}

/**
 * Direct YAML write — the original update path (fallback when no StateManager).
 */
function directYamlUpdate(projectPath: string, storyId: string, newStatus: string): boolean {
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
 * Find all stories that depend on a given story.
 * Reads the story_dependencies section of sprint-status.yaml.
 */
export function findDependentStories(
  sprintStatus: Record<string, unknown>,
  completedStoryId: string,
): string[] {
  // Use story_dependencies (story-level deps), falling back to dependencies for backward compat
  const deps = (sprintStatus.story_dependencies ?? sprintStatus.dependencies) as
    | Record<string, string[]>
    | undefined;
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
 * Check if all dependencies for a story are satisfied.
 * Reads the story_dependencies section of sprint-status.yaml.
 */
export function areDependenciesSatisfied(
  storyId: string,
  sprintStatus: Record<string, unknown>,
): boolean {
  // Use story_dependencies (story-level deps), falling back to dependencies for backward compat
  const deps = (sprintStatus.story_dependencies ?? sprintStatus.dependencies) as
    | Record<string, string[]>
    | undefined;
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
  const newlyUnblocked: string[] = [];

  try {
    const sprintStatus = loadSprintStatus(projectPath);
    if (!sprintStatus) {
      // No sprint status file - log warning but don't block completion
      // eslint-disable-next-line no-console
      console.warn(
        `[completion-handlers] No sprint-status.yaml found, skipping dependency unblocking for ${completedStoryId}`,
      );
      return [];
    }

    const dependents = findDependentStories(sprintStatus, completedStoryId);

    for (const storyId of dependents) {
      try {
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
      } catch (err) {
        // Log error for specific story but continue processing others
        // eslint-disable-next-line no-console
        console.error(`[completion-handlers] Failed to unblock story ${storyId}:`, err);
      }
    }
  } catch (err) {
    // Log error for dependency unblocking but don't block completion
    // eslint-disable-next-line no-console
    console.error(
      `[completion-handlers] Dependency unblocking failed for ${completedStoryId}:`,
      err,
    );
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
  configPath: string,
  auditDir: string,
  notifier?: Notifier,
  overrideSessionsDir?: string,
  stateManager?: StateManager,
  eventPublisher?: EventPublisher,
): CompletionHandler {
  return async (event: CompletionEvent) => {
    // Capture session logs before completion
    // Use overrideSessionsDir if provided (avoids hash mismatch when projectPath is a subdirectory)
    const sessionsDir = overrideSessionsDir ?? getSessionsDir(configPath, projectPath);
    const logPath = getLogFilePath(sessionsDir, event.agentId);
    await captureTmuxSessionLogs(event.agentId, logPath);

    // Store log path in metadata
    await storeLogPathInMetadata(sessionsDir, event.agentId, logPath);

    // Update agent status in registry
    const assignment = registry.getByAgent(event.agentId);
    if (assignment) {
      // Remove from registry (agent completed)
      registry.remove(event.agentId);
    }

    // Update story status to "done" — via StateManager if available, else direct YAML
    updateSprintStatus(projectPath, event.storyId, "done", stateManager);

    // Publish story.completed event (non-fatal)
    if (eventPublisher) {
      try {
        await eventPublisher.publishStoryCompleted({
          storyId: event.storyId,
          agentId: event.agentId,
          previousStatus: "in-progress",
          newStatus: "done",
          duration: event.duration,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[completion-handlers] Event publish failed:", err);
      }
    }

    // Log completion event
    logAuditEvent(auditDir, {
      timestamp: event.completedAt.toISOString(),
      event_type: "agent_completed",
      agent_id: event.agentId,
      story_id: event.storyId,
      exit_code: event.exitCode,
      duration_ms: event.duration,
    });

    // Capture session learning for AI intelligence (Cycle 3 — opt-in)
    try {
      const learningStore = getLearningStore();
      if (learningStore) {
        // Extract projectId from path — strip trailing slash, take last segment
        const normalizedPath = projectPath.endsWith("/") ? projectPath.slice(0, -1) : projectPath;
        const projectId = normalizedPath.split("/").pop() ?? "unknown";
        const learning = await captureSessionLearning(
          event,
          projectId,
          registry.getRetryCount(event.storyId),
        );
        await learningStore.store(learning);
      }
    } catch {
      // Learning capture failure must never break completion flow
    }

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
  configPath: string,
  auditDir: string,
  notifier?: Notifier,
  overrideSessionsDir?: string,
  stateManager?: StateManager,
  eventPublisher?: EventPublisher,
): FailureHandler {
  return async (event: FailureEvent) => {
    // Capture session logs before failure (if tmux session still exists)
    // Use overrideSessionsDir if provided (avoids hash mismatch when projectPath is a subdirectory)
    const sessionsDir = overrideSessionsDir ?? getSessionsDir(configPath, projectPath);
    const logPath = getLogFilePath(sessionsDir, event.agentId);
    await captureTmuxSessionLogs(event.agentId, logPath);

    // Store log path in metadata along with crash details
    await storeLogPathInMetadata(sessionsDir, event.agentId, logPath);

    // Update agent status in registry
    const assignment = registry.getByAgent(event.agentId);
    if (assignment) {
      // Mark as failed/disconnected/etc and remove from active monitoring
      registry.remove(event.agentId);
    }

    // Update story status to "blocked" (except for manual termination)
    // Via StateManager if available, else direct YAML
    if (event.reason !== "disconnected") {
      updateSprintStatus(projectPath, event.storyId, "blocked", stateManager);
    }

    // Publish story.blocked event (non-fatal, skip for manual disconnect)
    if (eventPublisher && event.reason !== "disconnected") {
      try {
        await eventPublisher.publishStoryBlocked({
          storyId: event.storyId,
          agentId: event.agentId,
          reason: event.reason,
          exitCode: event.exitCode,
          signal: event.signal,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[completion-handlers] Event publish failed:", err);
      }
    }

    // Store crash details in agent's session metadata for resume functionality
    updateMetadata(sessionsDir, event.agentId as SessionId, {
      exitCode: event.exitCode?.toString() ?? "",
      signal: event.signal ?? "",
      failureReason: event.reason,
    });

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

    // Capture session learning for AI intelligence (Cycle 3 — opt-in, failures too)
    try {
      const learningStore = getLearningStore();
      if (learningStore) {
        const normalizedPath = projectPath.endsWith("/") ? projectPath.slice(0, -1) : projectPath;
        const projectId = normalizedPath.split("/").pop() ?? "unknown";
        const learning = await captureSessionLearning(
          event,
          projectId,
          registry.getRetryCount(event.storyId),
        );
        await learningStore.store(learning);
      }
    } catch {
      // Learning capture failure must never break failure handling flow
    }

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
