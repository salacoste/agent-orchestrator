/**
 * Lifecycle Manager — state machine + polling loop + reaction engine.
 *
 * Periodically polls all sessions and:
 * 1. Detects state transitions (spawning → working → pr_open → etc.)
 * 2. Emits events on transitions
 * 3. Triggers reactions (auto-handle CI failures, review comments, etc.)
 * 4. Escalates to human notification when auto-handling fails
 *
 * Reference: scripts/claude-session-status, scripts/claude-review-check
 */

import { randomUUID } from "node:crypto";
import {
  SESSION_STATUS,
  PR_STATE,
  CI_STATUS,
  type LifecycleManager,
  type SessionManager,
  type SessionId,
  type SessionStatus,
  type EventType,
  type OrchestratorEvent,
  type OrchestratorConfig,
  type ReactionConfig,
  type ReactionResult,
  type PluginRegistry,
  type Runtime,
  type Agent,
  type SCM,
  type Notifier,
  type Session,
  type EventPriority,
  type Tracker,
} from "./types.js";
import { updateMetadata } from "./metadata.js";
import { getSessionsDir } from "./paths.js";
import {
  createDegradedModeService,
  type DegradedModeConfig,
  type DegradedModeStatus,
} from "./degraded-mode.js";

/** Parse a duration string like "10m", "30s", "1h" to milliseconds. */
function parseDuration(str: string): number {
  const match = str.match(/^(\d+)(s|m|h)$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60_000;
    case "h":
      return value * 3_600_000;
    default:
      return 0;
  }
}

/** Infer a reasonable priority from event type. */
function inferPriority(type: EventType): EventPriority {
  if (type.includes("stuck") || type.includes("needs_input") || type.includes("errored")) {
    return "urgent";
  }
  if (type.startsWith("summary.")) {
    return "info";
  }
  if (
    type.includes("approved") ||
    type.includes("ready") ||
    type.includes("merged") ||
    type.includes("completed")
  ) {
    return "action";
  }
  if (type.includes("fail") || type.includes("changes_requested") || type.includes("conflicts")) {
    return "warning";
  }
  return "info";
}

/** Create an OrchestratorEvent with defaults filled in. */
function createEvent(
  type: EventType,
  opts: {
    sessionId: SessionId;
    projectId: string;
    message: string;
    priority?: EventPriority;
    data?: Record<string, unknown>;
  },
): OrchestratorEvent {
  return {
    id: randomUUID(),
    type,
    priority: opts.priority ?? inferPriority(type),
    sessionId: opts.sessionId,
    projectId: opts.projectId,
    timestamp: new Date(),
    message: opts.message,
    data: opts.data ?? {},
  };
}

/** Determine which event type corresponds to a status transition. */
function statusToEventType(_from: SessionStatus | undefined, to: SessionStatus): EventType | null {
  switch (to) {
    case "working":
      return "session.working";
    case "pr_open":
      return "pr.created";
    case "ci_failed":
      return "ci.failing";
    case "review_pending":
      return "review.pending";
    case "changes_requested":
      return "review.changes_requested";
    case "approved":
      return "review.approved";
    case "mergeable":
      return "merge.ready";
    case "merged":
      return "merge.completed";
    case "needs_input":
      return "session.needs_input";
    case "stuck":
      return "session.stuck";
    case "errored":
      return "session.errored";
    case "killed":
      return "session.killed";
    default:
      return null;
  }
}

/** Map event type to reaction config key. */
function eventToReactionKey(eventType: EventType): string | null {
  switch (eventType) {
    case "ci.failing":
      return "ci-failed";
    case "review.changes_requested":
      return "changes-requested";
    case "automated_review.found":
      return "bugbot-comments";
    case "merge.conflicts":
      return "merge-conflicts";
    case "merge.ready":
      return "approved-and-green";
    case "session.stuck":
      return "agent-stuck";
    case "session.needs_input":
      return "agent-needs-input";
    case "session.killed":
      return "agent-exited";
    case "summary.all_complete":
      return "all-complete";
    case "tracker.story_done":
      return "tracker-story-done";
    case "tracker.sprint_complete":
      return "tracker-sprint-complete";
    default:
      return null;
  }
}

export interface LifecycleManagerDeps {
  config: OrchestratorConfig;
  registry: PluginRegistry;
  sessionManager: SessionManager;
}

/** Track attempt counts for reactions per session. */
interface ReactionTracker {
  attempts: number;
  firstTriggered: Date;
}

/** Create a LifecycleManager instance. */
export function createLifecycleManager(deps: LifecycleManagerDeps): LifecycleManager {
  const { config, registry, sessionManager } = deps;

  const states = new Map<SessionId, SessionStatus>();
  const reactionTrackers = new Map<string, ReactionTracker>(); // "sessionId:reactionKey"
  const sprintCompleteCache = new Map<string, boolean>(); // projectId -> last-known sprint-complete state
  const activeNotifications = new Map<string, Set<string>>(); // projectId -> set of active notification types
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let polling = false; // re-entrancy guard
  let allCompleteEmitted = false; // guard against repeated all_complete

  // Initialize DegradedModeService for monitoring service availability
  const degradedModeConfig: DegradedModeConfig = {
    eventsBackupPath: ".ao-events/degraded-events.jsonl",
    syncBackupPath: ".ao-events/degraded-syncs.jsonl",
    healthCheckIntervalMs: 5000, // Check every 5 seconds
    recoveryTimeoutMs: 30000, // 30 second recovery timeout
  };
  const degradedModeService = createDegradedModeService(degradedModeConfig);

  // Register health checks for monitored services
  // Event bus health check - assumes healthy for now as EventBus is managed separately
  degradedModeService.registerHealthCheck("event-bus", async () => {
    // TODO: Implement actual event bus health check
    // EventBus instances are not managed via the plugin registry
    // For now, assume event bus is healthy
    return true;
  });

  // BMAD tracker health check
  degradedModeService.registerHealthCheck("bmad-tracker", async () => {
    // Check if at least one BMAD tracker is configured and responsive
    try {
      for (const [, project] of Object.entries(config.projects)) {
        if (project.tracker?.plugin === "bmad") {
          const tracker = registry.get<Tracker>("tracker", "bmad");
          if (tracker && tracker.listIssues) {
            // Try a simple health check - can we list issues?
            await tracker.listIssues({ state: "all", limit: 1 }, project);
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  });

  /** Determine current status for a session by polling plugins. */
  async function determineStatus(session: Session): Promise<SessionStatus> {
    const project = config.projects[session.projectId];
    if (!project) return session.status;

    const agentName = session.metadata["agent"] ?? project.agent ?? config.defaults.agent;
    const agent = registry.get<Agent>("agent", agentName);
    const scm = project.scm ? registry.get<SCM>("scm", project.scm.plugin) : null;

    // 1. Check if runtime is alive
    if (session.runtimeHandle) {
      const runtime = registry.get<Runtime>("runtime", project.runtime ?? config.defaults.runtime);
      if (runtime) {
        const alive = await runtime.isAlive(session.runtimeHandle).catch(() => true);
        if (!alive) return "killed";
      }
    }

    // 2. Check agent activity -- prefer JSONL-based detection (runtime-agnostic)
    if (agent && session.runtimeHandle) {
      try {
        // Try JSONL-based activity detection first (reads agent's session files directly)
        const activityState = await agent.getActivityState(session, config.readyThresholdMs);
        if (activityState) {
          if (activityState.state === "waiting_input") return "needs_input";
          if (activityState.state === "exited") return "killed";
          // active/ready/idle/blocked -- proceed to PR checks below
        } else {
          // getActivityState returned null -- fall back to terminal output parsing
          const runtime = registry.get<Runtime>(
            "runtime",
            project.runtime ?? config.defaults.runtime,
          );
          const terminalOutput = runtime ? await runtime.getOutput(session.runtimeHandle, 10) : "";
          if (terminalOutput) {
            const activity = agent.detectActivity(terminalOutput);
            if (activity === "waiting_input") return "needs_input";

            const processAlive = await agent.isProcessRunning(session.runtimeHandle);
            if (!processAlive) return "killed";
          }
        }
      } catch {
        // On probe failure, preserve current stuck/needs_input state rather
        // than letting the fallback at the bottom coerce them to "working"
        if (
          session.status === SESSION_STATUS.STUCK ||
          session.status === SESSION_STATUS.NEEDS_INPUT
        ) {
          return session.status;
        }
      }
    }

    // 3. Auto-detect PR by branch if metadata.pr is missing.
    //    This is critical for agents without auto-hook systems (Codex, Aider,
    //    OpenCode) that can't reliably write pr=<url> to metadata on their own.
    if (!session.pr && scm && session.branch) {
      try {
        const detectedPR = await scm.detectPR(session, project);
        if (detectedPR) {
          session.pr = detectedPR;
          // Persist PR URL so subsequent polls don't need to re-query.
          // Don't write status here -- step 4 below will determine the
          // correct status (merged, ci_failed, etc.) on this same cycle.
          const sessionsDir = getSessionsDir(config.configPath, project.path);
          updateMetadata(sessionsDir, session.id, { pr: detectedPR.url });
        }
      } catch {
        // SCM detection failed -- will retry next poll
      }
    }

    // 4. Check PR state if PR exists
    if (session.pr && scm) {
      try {
        const prState = await scm.getPRState(session.pr);
        if (prState === PR_STATE.MERGED) return "merged";
        if (prState === PR_STATE.CLOSED) return "killed";

        // Check CI
        const ciStatus = await scm.getCISummary(session.pr);
        if (ciStatus === CI_STATUS.FAILING) return "ci_failed";

        // Check reviews
        const reviewDecision = await scm.getReviewDecision(session.pr);
        if (reviewDecision === "changes_requested") return "changes_requested";
        if (reviewDecision === "approved") {
          // Check merge readiness
          const mergeReady = await scm.getMergeability(session.pr);
          if (mergeReady.mergeable) return "mergeable";
          return "approved";
        }
        if (reviewDecision === "pending") return "review_pending";

        return "pr_open";
      } catch {
        // SCM check failed -- keep current status
      }
    }

    // 5. Default: if agent is active, it's working
    if (
      session.status === "spawning" ||
      session.status === SESSION_STATUS.STUCK ||
      session.status === SESSION_STATUS.NEEDS_INPUT
    ) {
      return "working";
    }
    return session.status;
  }

  /** Execute a reaction for a session. */
  async function executeReaction(
    sessionId: SessionId,
    projectId: string,
    reactionKey: string,
    reactionConfig: ReactionConfig,
  ): Promise<ReactionResult> {
    const trackerKey = `${sessionId}:${reactionKey}`;
    let tracker = reactionTrackers.get(trackerKey);

    if (!tracker) {
      tracker = { attempts: 0, firstTriggered: new Date() };
      reactionTrackers.set(trackerKey, tracker);
    }

    // Increment attempts before checking escalation
    tracker.attempts++;

    // Check if we should escalate
    const maxRetries = reactionConfig.retries ?? Infinity;
    const escalateAfter = reactionConfig.escalateAfter;
    let shouldEscalate = false;

    if (tracker.attempts > maxRetries) {
      shouldEscalate = true;
    }

    if (typeof escalateAfter === "string") {
      const durationMs = parseDuration(escalateAfter);
      if (durationMs > 0 && Date.now() - tracker.firstTriggered.getTime() > durationMs) {
        shouldEscalate = true;
      }
    }

    if (typeof escalateAfter === "number" && tracker.attempts > escalateAfter) {
      shouldEscalate = true;
    }

    if (shouldEscalate) {
      // Escalate to human
      const event = createEvent("reaction.escalated", {
        sessionId,
        projectId,
        message: `Reaction '${reactionKey}' escalated after ${tracker.attempts} attempts`,
        data: { reactionKey, attempts: tracker.attempts },
      });
      await notifyHuman(event, reactionConfig.priority ?? "urgent");
      return {
        reactionType: reactionKey,
        success: true,
        action: "escalated",
        escalated: true,
      };
    }

    // Execute the reaction action
    const action = reactionConfig.action ?? "notify";

    switch (action) {
      case "send-to-agent": {
        if (reactionConfig.message) {
          try {
            await sessionManager.send(sessionId, reactionConfig.message);

            return {
              reactionType: reactionKey,
              success: true,
              action: "send-to-agent",
              message: reactionConfig.message,
              escalated: false,
            };
          } catch {
            // Send failed -- allow retry on next poll cycle (don't escalate immediately)
            return {
              reactionType: reactionKey,
              success: false,
              action: "send-to-agent",
              escalated: false,
            };
          }
        }
        break;
      }

      case "notify": {
        const event = createEvent("reaction.triggered", {
          sessionId,
          projectId,
          message: `Reaction '${reactionKey}' triggered notification`,
          data: { reactionKey },
        });
        await notifyHuman(event, reactionConfig.priority ?? "info");
        return {
          reactionType: reactionKey,
          success: true,
          action: "notify",
          escalated: false,
        };
      }

      case "auto-merge": {
        // Auto-merge is handled by the SCM plugin
        // For now, just notify
        const event = createEvent("reaction.triggered", {
          sessionId,
          projectId,
          message: `Reaction '${reactionKey}' triggered auto-merge`,
          data: { reactionKey },
        });
        await notifyHuman(event, "action");
        return {
          reactionType: reactionKey,
          success: true,
          action: "auto-merge",
          escalated: false,
        };
      }
    }

    return {
      reactionType: reactionKey,
      success: false,
      action,
      escalated: false,
    };
  }

  /** Send a notification to all configured notifiers. */
  async function notifyHuman(event: OrchestratorEvent, priority: EventPriority): Promise<void> {
    const eventWithPriority = { ...event, priority };
    const notifierNames = config.notificationRouting[priority] ?? config.defaults.notifiers;

    for (const name of notifierNames) {
      const notifier = registry.get<Notifier>("notifier", name);
      if (notifier) {
        try {
          await notifier.notify(eventWithPriority);
        } catch {
          // Notifier failed -- not much we can do
        }
      }
    }
  }

  /** Poll a single session and handle state transitions. */
  async function checkSession(session: Session): Promise<void> {
    // Use tracked state if available; otherwise use the persisted metadata status
    // (not session.status, which list() may have already overwritten for dead runtimes).
    // This ensures transitions are detected after a lifecycle manager restart.
    const tracked = states.get(session.id);
    const oldStatus =
      tracked ?? ((session.metadata?.["status"] as SessionStatus | undefined) || session.status);
    const newStatus = await determineStatus(session);

    if (newStatus !== oldStatus) {
      // State transition detected
      states.set(session.id, newStatus);

      // Update metadata -- session.projectId is the config key (e.g., "my-app")
      const project = config.projects[session.projectId];
      if (project) {
        const sessionsDir = getSessionsDir(config.configPath, project.path);
        updateMetadata(sessionsDir, session.id, { status: newStatus });
      }

      // Reset allCompleteEmitted when any session becomes active again
      if (newStatus !== "merged" && newStatus !== "killed") {
        allCompleteEmitted = false;
      }

      // Clear reaction trackers for the old status so retries reset on state changes
      const oldEventType = statusToEventType(undefined, oldStatus);
      if (oldEventType) {
        const oldReactionKey = eventToReactionKey(oldEventType);
        if (oldReactionKey) {
          reactionTrackers.delete(`${session.id}:${oldReactionKey}`);
        }
      }

      // Auto-update tracker when PR is merged
      if (newStatus === "merged") {
        const project = config.projects[session.projectId];
        if (project?.tracker) {
          const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
          if (tracker) {
            // Resolve issue ID from branch if not set on the session
            let issueId = session.issueId;
            if (!issueId && session.branch && tracker.findIssueByBranch) {
              try {
                issueId = await tracker.findIssueByBranch(session.branch, project);
              } catch {
                // Non-fatal -- branch lookup failed
              }
            }

            if (issueId) {
              // Use onPRMerge if available (handles transition + history + events)
              // Otherwise fall back to generic updateIssue
              try {
                if (tracker.onPRMerge) {
                  await tracker.onPRMerge(issueId, session.pr?.url, project);
                } else if (tracker.updateIssue) {
                  await tracker.updateIssue(issueId, { state: "closed" }, project);
                }
              } catch {
                // Non-fatal -- don't disrupt lifecycle management if tracker update fails
              }

              // Emit tracker.story_done event and check for reactions
              const storyDoneEvent = createEvent("tracker.story_done", {
                sessionId: session.id,
                projectId: session.projectId,
                message: `Story ${issueId} completed (PR merged)`,
                data: { identifier: issueId },
              });

              // Enrich event with issue details
              try {
                const issue = await tracker.getIssue(issueId, project);
                storyDoneEvent.message = `Story "${issue.title}" (${issueId}) completed`;
                storyDoneEvent.data["storyTitle"] = issue.title;
                const epicLabel = issue.labels.find((l) => l.startsWith("epic-"));
                if (epicLabel) {
                  storyDoneEvent.data["epicId"] = epicLabel;
                }
              } catch {
                // Non-fatal -- emit event without title or epic info
              }

              // Check for reaction config
              const reactionKey = eventToReactionKey("tracker.story_done");
              if (reactionKey) {
                const globalReaction = config.reactions[reactionKey];
                const projectReaction = project?.reactions?.[reactionKey];
                const reactionConfig = projectReaction
                  ? { ...globalReaction, ...projectReaction }
                  : globalReaction;

                let reactionHandled = false;
                if (reactionConfig?.action) {
                  if (reactionConfig.auto !== false || reactionConfig.action === "notify") {
                    await executeReaction(
                      session.id,
                      session.projectId,
                      reactionKey,
                      reactionConfig as ReactionConfig,
                    );
                    reactionHandled = true;
                  }
                }
                if (!reactionHandled) {
                  await notifyHuman(storyDoneEvent, "info");
                }
              }
            }
          }
        }
      }

      // Task 10: Reset story status when session dies without PR merge
      if (
        (newStatus === "killed" || newStatus === "errored" || newStatus === "stuck") &&
        oldStatus !== newStatus
      ) {
        const project = config.projects[session.projectId];
        if (project?.tracker) {
          const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
          const issueId = session.issueId;
          if (tracker?.onSessionDeath && issueId) {
            try {
              await tracker.onSessionDeath(issueId, project);
            } catch {
              // Non-fatal -- don't disrupt lifecycle on tracker reset failure
            }
          }
        }
      }

      // Handle transition: notify humans and/or trigger reactions
      const eventType = statusToEventType(oldStatus, newStatus);
      if (eventType) {
        let reactionHandledNotify = false;
        const reactionKey = eventToReactionKey(eventType);

        if (reactionKey) {
          // Merge project-specific overrides with global defaults
          const project = config.projects[session.projectId];
          const globalReaction = config.reactions[reactionKey];
          const projectReaction = project?.reactions?.[reactionKey];
          const reactionConfig = projectReaction
            ? { ...globalReaction, ...projectReaction }
            : globalReaction;

          if (reactionConfig && reactionConfig.action) {
            // auto: false skips automated agent actions but still allows notifications
            if (reactionConfig.auto !== false || reactionConfig.action === "notify") {
              await executeReaction(
                session.id,
                session.projectId,
                reactionKey,
                reactionConfig as ReactionConfig,
              );
              // Reaction is handling this event -- suppress immediate human notification.
              // "send-to-agent" retries + escalates on its own; "notify"/"auto-merge"
              // already call notifyHuman internally. Notifying here would bypass the
              // delayed escalation behaviour configured via retries/escalateAfter.
              reactionHandledNotify = true;
            }
          }
        }

        // For significant transitions not already notified by a reaction, notify humans
        if (!reactionHandledNotify) {
          const priority = inferPriority(eventType);
          if (priority !== "info") {
            const event = createEvent(eventType, {
              sessionId: session.id,
              projectId: session.projectId,
              message: `${session.id}: ${oldStatus} -> ${newStatus}`,
              data: { oldStatus, newStatus },
            });
            await notifyHuman(event, priority);
          }
        }
      }
    } else {
      // No transition but track current state
      states.set(session.id, newStatus);
    }
  }

  /** Run one polling cycle across all sessions. */
  async function pollAll(): Promise<void> {
    // Re-entrancy guard: skip if previous poll is still running
    if (polling) return;
    polling = true;

    try {
      const sessions = await sessionManager.list();

      // Include sessions that are active OR whose status changed from what we last saw
      // (e.g., list() detected a dead runtime and marked it "killed" -- we need to
      // process that transition even though the new status is terminal)
      const sessionsToCheck = sessions.filter((s) => {
        if (s.status !== "merged" && s.status !== "killed") return true;
        const tracked = states.get(s.id);
        return tracked !== undefined && tracked !== s.status;
      });

      // Poll all sessions concurrently
      await Promise.allSettled(sessionsToCheck.map((s) => checkSession(s)));

      // Prune stale entries from states and reactionTrackers for sessions
      // that no longer appear in the session list (e.g., after kill/cleanup)
      const currentSessionIds = new Set(sessions.map((s) => s.id));
      for (const trackedId of states.keys()) {
        if (!currentSessionIds.has(trackedId)) {
          states.delete(trackedId);
        }
      }
      for (const trackerKey of reactionTrackers.keys()) {
        const sessionId = trackerKey.split(":")[0];
        if (sessionId && !currentSessionIds.has(sessionId)) {
          reactionTrackers.delete(trackerKey);
        }
      }

      // Check if all sessions are complete (trigger reaction only once)
      const activeSessions = sessions.filter((s) => s.status !== "merged" && s.status !== "killed");
      if (sessions.length > 0 && activeSessions.length === 0 && !allCompleteEmitted) {
        allCompleteEmitted = true;

        // Execute all-complete reaction if configured
        const reactionKey = eventToReactionKey("summary.all_complete");
        if (reactionKey) {
          const reactionConfig = config.reactions[reactionKey];
          if (reactionConfig && reactionConfig.action) {
            if (reactionConfig.auto !== false || reactionConfig.action === "notify") {
              await executeReaction("system", "all", reactionKey, reactionConfig as ReactionConfig);
            }
          }
        }
      }

      // Check sprint completion for each project that has a tracker with listIssues.
      // Uses sprintCompleteCache to emit tracker.sprint_complete only on the
      // transition from not-complete to complete (avoids repeated notifications).
      for (const [projectId, project] of Object.entries(config.projects)) {
        if (!project.tracker?.plugin) continue;

        const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
        if (!tracker?.listIssues) continue;

        let allDone = false;
        try {
          const issues = await tracker.listIssues({ state: "all", limit: 1000 }, project);
          // Sprint is complete when there is at least one issue and none are open/in_progress
          allDone =
            issues.length > 0 &&
            issues.every((issue) => issue.state === "closed" || issue.state === "cancelled");
        } catch {
          // Non-fatal -- skip sprint check for this project on this cycle
          continue;
        }

        const wasComplete = sprintCompleteCache.get(projectId) ?? false;
        sprintCompleteCache.set(projectId, allDone);

        // Emit only on the transition from not-complete to complete
        if (allDone && !wasComplete) {
          const sprintEvent = createEvent("tracker.sprint_complete", {
            sessionId: "system",
            projectId,
            message: `Sprint complete for project ${projectId}`,
            priority: "action",
            data: { projectId },
          });

          const sprintReactionKey = eventToReactionKey("tracker.sprint_complete");
          if (sprintReactionKey) {
            const globalReaction = config.reactions[sprintReactionKey];
            const projectReaction = project.reactions?.[sprintReactionKey];
            const reactionConfig = projectReaction
              ? { ...globalReaction, ...projectReaction }
              : globalReaction;

            let sprintReactionHandled = false;
            if (reactionConfig?.action) {
              if (reactionConfig.auto !== false || reactionConfig.action === "notify") {
                await executeReaction(
                  "system",
                  projectId,
                  sprintReactionKey,
                  reactionConfig as ReactionConfig,
                );
                sprintReactionHandled = true;
              }
            }
            if (!sprintReactionHandled) {
              await notifyHuman(sprintEvent, "action");
            }
          } else {
            await notifyHuman(sprintEvent, "action");
          }
        }
      }

      // Check tracker notifications (health alerts, stuck stories, WIP, forecast).
      // Uses activeNotifications to debounce: only dispatch when a new notification
      // type appears, not on every poll cycle.
      for (const [projectId, project] of Object.entries(config.projects)) {
        if (!project.tracker) continue;

        const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
        if (!tracker?.getNotifications) continue;

        try {
          const events = await tracker.getNotifications(project);
          const currentTypes = new Set(events.map((e) => e.type));
          const previousTypes = activeNotifications.get(projectId) ?? new Set<string>();

          // Find newly appeared notification types
          for (const event of events) {
            if (!previousTypes.has(event.type)) {
              await notifyHuman(event, event.priority);
            }
          }

          activeNotifications.set(projectId, currentTypes);
        } catch {
          // Non-fatal -- skip notification check for this project on this cycle
        }
      }
    } catch {
      // Poll cycle failed -- will retry next interval
    } finally {
      polling = false;
    }
  }

  return {
    start(intervalMs = 30_000): void {
      if (pollTimer) return; // Already running
      pollTimer = setInterval(() => void pollAll(), intervalMs);
      // Run immediately on start
      void pollAll();
      // Start degraded mode service
      void degradedModeService.start();
    },

    stop(): void {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      // Stop degraded mode service
      void degradedModeService.stop();
    },

    getStates(): Map<SessionId, SessionStatus> {
      return new Map(states);
    },

    async check(sessionId: SessionId): Promise<void> {
      const session = await sessionManager.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);
      await checkSession(session);
    },

    getDegradedModeStatus(): DegradedModeStatus {
      return degradedModeService.getStatus();
    },
  };
}
