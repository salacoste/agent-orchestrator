/**
 * Shared detection wiring for story-spawned sessions.
 *
 * Provides completion and blocked detection monitoring for any CLI command
 * that spawns a story-aware agent session (spawn --story, resume).
 * Runs for the lifetime of the CLI process. Non-fatal if setup fails.
 */

import chalk from "chalk";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  type OrchestratorConfig,
  type AgentRegistry,
  type EventBus,
  type EventBusEvent,
  type EventSubscriber,
  type StateManager,
  type SyncBridge,
  type EventPublisher,
  type NotificationService,
  type NotificationPreferences,
  createAgentCompletionDetector,
  createBlockedAgentDetector,
  createCompletionHandler,
  createFailureHandler,
  createEventPublisher,
  createSyncBridge,
  createDependencyResolver,
  createBurndownService,
  createStateConflictReconciler,
  createConflictResolver,
  createNotificationService,
  updateMetadata,
} from "@composio/ao-core";
import { createBMADTrackerAdapter } from "@composio/ao-plugin-tracker-bmad";
import { getRuntime, getNotificationPlugins } from "./plugins.js";
import { getSessionManager } from "./create-session-manager.js";

/**
 * Minimal in-memory EventBus for CLI-lifetime event dispatch.
 * Used by BlockedAgentDetector to publish/subscribe agent.blocked/agent.resumed events
 * within the CLI process. No persistence or network — events only live in memory.
 */
export function createInMemoryEventBus(): EventBus {
  const subscribers: EventSubscriber[] = [];
  return {
    name: "in-memory",
    async publish(event) {
      const fullEvent: EventBusEvent = {
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        ...event,
      };
      for (const sub of subscribers) {
        sub(fullEvent);
      }
    },
    async subscribe(callback) {
      subscribers.push(callback);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    isConnected: () => true,
    isDegraded: () => false,
    getQueueSize: () => 0,
    async close() {
      subscribers.length = 0;
    },
  };
}

/**
 * Wire notification service and state conflict reconciler.
 * Extracted from wireDetection for maintainability (Epic 2 retro action item #1).
 *
 * @returns NotificationService instance if configured, undefined otherwise
 */
async function wireNotificationServices(
  config: OrchestratorConfig,
  eventBus: EventBus,
  auditDir: string,
  stateManager: StateManager | undefined,
  eventPublisher: EventPublisher | undefined,
): Promise<NotificationService | undefined> {
  let notificationService: NotificationService | undefined;

  // --- Notification service: queue, dedup, route notifications to plugins (non-fatal) ---
  try {
    const notificationPlugins = getNotificationPlugins(config);

    if (notificationPlugins.length > 0) {
      // Convert notificationRouting (Record<priority, string[]>) to NotificationPreferences
      const preferences: NotificationPreferences = {};
      for (const [priority, pluginNames] of Object.entries(config.notificationRouting)) {
        if (Array.isArray(pluginNames) && pluginNames.length > 0) {
          preferences[priority] = pluginNames.join(",");
        }
      }

      notificationService = createNotificationService({
        eventBus,
        plugins: notificationPlugins,
        dlqPath: join(auditDir, "notification-dlq.jsonl"),
        preferences: Object.keys(preferences).length > 0 ? preferences : undefined,
      });

      console.log(
        chalk.dim(`  ✓ Notification service: ${notificationPlugins.map((p) => p.name).join(", ")}`),
      );
    }
  } catch (err) {
    console.log(
      chalk.dim(
        `  ⚠ Notification service setup skipped: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  // --- State conflict reconciler: available for state update conflict handling (non-fatal) ---
  try {
    if (stateManager) {
      const reconciler = createStateConflictReconciler({
        stateManager,
        conflictResolver: createConflictResolver(stateManager),
        eventPublisher,
        notificationService,
      });

      // Subscribe to story.blocked events from conflict escalation for CLI logging
      await eventBus.subscribe((event: EventBusEvent) => {
        if (event.eventType === "story.blocked") {
          const reason = event.metadata["reason"] as string | undefined;
          if (reason && reason.includes("State conflict unresolved")) {
            const storyId = event.metadata["storyId"] as string | undefined;
            console.log(
              chalk.yellow(
                `\n⚠ State conflict unresolved for ${storyId ?? "unknown"} — human review needed`,
              ),
            );
          }
        }
      });

      // Make reconciler available (currently for logging; future stories may use it directly)
      void reconciler;
    }
  } catch (err) {
    console.log(
      chalk.dim(
        `  ⚠ State conflict reconciler setup skipped: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  return notificationService;
}

/**
 * Wire up completion and blocked detection for a story-spawned session.
 * Runs for the lifetime of the CLI process. Non-fatal if setup fails.
 *
 * @param config - Orchestrator config
 * @param projectId - Project identifier
 * @param sessionId - Session to monitor
 * @param sessionsDir - Sessions directory (for metadata writes)
 * @param projectPath - Project root path (for sprint-status.yaml updates)
 * @param registry - Agent registry instance
 */
export async function wireDetection(
  config: OrchestratorConfig,
  projectId: string,
  sessionId: string,
  sessionsDir: string,
  projectPath: string,
  registry: AgentRegistry,
): Promise<void> {
  const runtime = getRuntime(config, projectId);
  const auditDir = join(sessionsDir, ".audit");

  // --- Event publishing & state sync (non-fatal) ---
  const eventBus = createInMemoryEventBus();
  let eventPublisher: EventPublisher | undefined;
  let syncBridge: SyncBridge | undefined;
  let stateManager: StateManager | undefined;

  try {
    // Create EventPublisher wired to the in-memory event bus
    eventPublisher = createEventPublisher({ eventBus });

    // Create SyncBridge for bidirectional YAML state sync
    const projectConfig = config.projects[projectId];
    if (projectConfig) {
      const bmadTracker = createBMADTrackerAdapter(projectConfig);

      const outputDir =
        typeof projectConfig.tracker?.["outputDir"] === "string"
          ? projectConfig.tracker["outputDir"]
          : "_bmad-output";
      syncBridge = createSyncBridge({
        sprintStatusPath: join(projectConfig.path, outputDir, "sprint-status.yaml"),
        bmadTracker,
        eventBus,
      });
      await syncBridge.initialize();
      stateManager = syncBridge.getStateManager();
    }
  } catch (err) {
    // Non-fatal: event publishing and state sync are enhancements, not critical
    console.log(
      chalk.dim(
        `  ⚠ Event/sync setup skipped: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  // --- Dependency resolver: subscribe to story.completed events (non-fatal) ---
  try {
    const depResolver = createDependencyResolver({
      projectPath,
      auditDir,
      eventPublisher,
    });

    await eventBus.subscribe((event: EventBusEvent) => {
      if (event.eventType === "story.completed") {
        void depResolver.onStoryCompleted(event).then((unblocked) => {
          if (unblocked.length > 0) {
            console.log(
              chalk.green(
                `  ↳ Unblocked ${unblocked.length} dependent stor${unblocked.length === 1 ? "y" : "ies"}: ${unblocked.join(", ")}`,
              ),
            );
          }
        });
      }
    });
  } catch (err) {
    console.log(
      chalk.dim(
        `  ⚠ Dependency resolver setup skipped: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  // --- Burndown service: subscribe to story.completed events (non-fatal) ---
  try {
    const burndownService = createBurndownService({
      projectPath,
    });

    await eventBus.subscribe((event: EventBusEvent) => {
      if (event.eventType === "story.completed") {
        void burndownService.onStoryCompleted(event).then(() => {
          const result = burndownService.getResult();
          console.log(
            chalk.dim(
              `  ↳ Burndown: ${result.completedStories}/${result.totalStories} stories done (${result.completionPercentage.toFixed(0)}%)`,
            ),
          );
        });
      }
    });
  } catch (err) {
    console.log(
      chalk.dim(
        `  ⚠ Burndown service setup skipped: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  // --- Notification & conflict reconciliation (extracted for maintainability) ---
  const notificationService = await wireNotificationServices(
    config,
    eventBus,
    auditDir,
    stateManager,
    eventPublisher,
  );

  // Completion detection
  const completionDetector = createAgentCompletionDetector({
    runtime,
    registry,
  });

  // Pass sessionsDir override so the handler uses the correct sessions directory
  // (projectPath may differ from projectId used to compute sessionsDir elsewhere)
  completionDetector.onCompletion(
    createCompletionHandler(
      registry,
      projectPath,
      config.configPath,
      auditDir,
      undefined,
      sessionsDir,
      stateManager,
      eventPublisher,
    ),
  );
  completionDetector.onFailure(
    createFailureHandler(
      registry,
      projectPath,
      config.configPath,
      auditDir,
      undefined,
      sessionsDir,
      stateManager,
      eventPublisher,
    ),
  );

  // CLI-specific handlers: print result and exit
  completionDetector.onCompletion(async (event) => {
    console.log(
      chalk.green(
        `\n✓ Agent ${event.agentId} completed story ${event.storyId} (exit code ${event.exitCode})`,
      ),
    );
    await cleanup();
  });
  completionDetector.onFailure(async (event) => {
    console.log(
      chalk.red(
        `\n✗ Agent ${event.agentId} failed on story ${event.storyId} (reason: ${event.reason})`,
      ),
    );
    await cleanup();
  });

  await completionDetector.monitor(sessionId);

  // Blocked detection
  const sm = await getSessionManager(config);
  const blockedDetector = createBlockedAgentDetector({
    eventBus,
    registry,
    sessionManager: sm,
  });

  await blockedDetector.trackActivity(sessionId);
  blockedDetector.startDetection();

  // Subscribe to blocked/resumed events to update registry + metadata
  await eventBus.subscribe((event) => {
    const agentId = event.metadata["agentId"] as string | undefined;
    if (!agentId) return;

    if (event.eventType === "agent.blocked") {
      registry.updateStatus(agentId, "blocked");
      updateMetadata(sessionsDir, agentId, { agentStatus: "blocked" });
      console.log(chalk.yellow(`\n⚠ Agent ${agentId} appears blocked (inactive)`));
    } else if (event.eventType === "agent.resumed") {
      registry.updateStatus(agentId, "active");
      updateMetadata(sessionsDir, agentId, { agentStatus: "active" });
      console.log(chalk.green(`\n↻ Agent ${agentId} resumed activity`));
    }
  });

  // Cleanup function for graceful shutdown (guarded against double invocation)
  let cleanedUp = false;
  async function cleanup(): Promise<void> {
    if (cleanedUp) return;
    cleanedUp = true;
    await completionDetector.unmonitor(sessionId);
    await blockedDetector.close();
    if (notificationService) await notificationService.close();
    if (eventPublisher) await eventPublisher.close();
    if (syncBridge) await syncBridge.close();
    await eventBus.close();
  }

  // Handle Ctrl+C — clean up detectors and exit
  process.once("SIGINT", () => {
    console.log(chalk.dim("\n\nDetaching from monitoring (agent continues in background)..."));
    void cleanup().then(() => process.exit(0));
  });

  console.log(
    chalk.dim("  Monitoring agent session... Press Ctrl+C to detach (agent keeps running).\n"),
  );
}
