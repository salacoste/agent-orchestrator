/**
 * Webhook endpoint for Telegram bot updates.
 *
 * Receives POST requests from Telegram's webhook system,
 * validates the secret token, and passes the update to the bot.
 * Story 57.1 Task 4 + Story 57.5 Task 4 + Story 57.6 Task 4 + Story 57.7 Task 4 + Story 57.8 Task 4 + Story 57.9 Task 4 + Story 57.10 Task 8 + Story 57.14 Task 4.
 */

import { type NextRequest, NextResponse } from "next/server.js";
import type {
  TelegramBot,
  StatusProvider,
  FleetProvider,
  SprintProvider,
  SprintEntry,
  HealthProvider,
  ConflictsProvider,
  CallbackUserInfo,
  CallbackAction,
} from "@composio/ao-plugin-notifier-telegram";
import {
  ACTIVITY_STATE,
  createHealthCheckService,
  createResourceConflictStore,
  type SessionManager,
  type OrchestratorConfig,
  type ApprovalService,
} from "@composio/ao-core";
import { approvalService as sharedApprovalService } from "@/app/api/approvals/shared";

// Lazy-initialized bot — loaded from config on first request.
// NOTE: Module-level state persists until server restart. If the Telegram
// config changes (e.g., token rotation), the bot instance will be stale.
// This is acceptable for the current single-config lifecycle. A future story
// could add a reset mechanism triggered by config reload.
let _bot: TelegramBot | null = null;
let _webhookSecret: string | null = null;

/**
 * Look up a project config key by display name or key (case-insensitive).
 * Shared helper for provider functions.
 * Story 57.10 Task 8.4.
 */
function resolveProjectKey(
  projects: Record<string, { name: string }>,
  name: string,
): string | undefined {
  return Object.keys(projects).find(
    (k) =>
      projects[k].name.toLowerCase() === name.toLowerCase() ||
      k.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * Create a function that returns the list of configured project names.
 * Story 57.10 Task 8.6.
 */
function createProjectListProvider(config: OrchestratorConfig): () => string[] {
  const projects = config.projects as Record<string, { name: string }>;
  return () => Object.values(projects).map((p) => p.name);
}

/**
 * Create a StatusProvider backed by core SessionManager.
 * Derives agent/activity counts from SessionManager.list().
 * Story 57.5 Task 4 + Story 57.10 Task 8.1.
 */
function createStatusProvider(
  sessionManager: SessionManager,
  config: OrchestratorConfig,
): StatusProvider {
  const projects = config.projects as Record<string, { name: string }>;

  return async (projectId?: string) => {
    const resolvedId = projectId
      ? (resolveProjectKey(projects, projectId) ?? projectId)
      : undefined;
    const sessions = await sessionManager.list(resolvedId);

    // "activeAgents" counts all non-exited sessions (working + blocked + idle)
    const active = sessions.filter((s) => s.activity !== ACTIVITY_STATE.EXITED);
    const working = sessions.filter((s) => s.status === "working");
    const blocked = sessions.filter(
      (s) => s.status === "blocked" || s.activity === ACTIVITY_STATE.BLOCKED,
    );
    const idle = sessions.filter((s) => s.activity === ACTIVITY_STATE.IDLE);
    const hasPR = sessions.filter((s) => s.pr !== null);

    return {
      activeAgents: active.length,
      totalSessions: sessions.length,
      workingSessions: working.length,
      blockedSessions: blocked.length,
      idleSessions: idle.length,
      openPRs: hasPR.length,
      needsReview: 0, // PRInfo doesn't carry reviewDecision; deferred to Story 57-10
      healthStatus: "unknown" as const, // Deferred to Story 57-8 /health command
      timestamp: new Date().toISOString(),
    };
  };
}

/**
 * Create a FleetProvider backed by core SessionManager and config.
 * Maps each session to a FleetAgent with project name resolution.
 * Story 57.6 Task 4.
 */
function createFleetProvider(
  sessionManager: SessionManager,
  config: OrchestratorConfig,
): FleetProvider {
  const projects = config.projects as Record<string, { name: string }>;

  return async (projectId?: string) => {
    const resolvedId = projectId
      ? (resolveProjectKey(projects, projectId) ?? projectId)
      : undefined;
    const sessions = await sessionManager.list(resolvedId);

    return sessions
      .filter((s) => s.activity !== ACTIVITY_STATE.EXITED)
      .map((s) => {
        const isAlert =
          s.activity === ACTIVITY_STATE.BLOCKED ||
          s.status === "errored" ||
          s.status === "ci_failed" ||
          s.status === "stuck";

        return {
          id: s.id,
          project: projects[s.projectId]?.name ?? s.projectId,
          status: s.status,
          activity: s.activity ?? "unknown",
          story: s.issueId ?? undefined,
          branch: s.branch ?? undefined,
          isAlert,
        };
      });
  };
}

/**
 * Create a SprintProvider backed by core SessionManager and config.
 * Computes per-project sprint metrics from live session data.
 * Story 57.7 Task 4.
 */
function createSprintProvider(
  sessionManager: SessionManager,
  config: OrchestratorConfig,
): SprintProvider {
  const projects = config.projects as Record<string, { name: string }>;

  /** Check whether a session is in a blocked/alert state. */
  const isBlocked = (s: { activity: string | null; status: string }): boolean =>
    s.activity === ACTIVITY_STATE.BLOCKED ||
    s.status === "errored" ||
    s.status === "ci_failed" ||
    s.status === "stuck";

  return async (projectId?: string) => {
    const projectIds = projectId
      ? [resolveProjectKey(projects, projectId) ?? projectId]
      : Object.keys(projects);
    const entries = [];

    for (const pid of projectIds) {
      const sessions = await sessionManager.list(pid);
      if (sessions.length === 0) continue;

      const done = sessions.filter((s) => s.status === "done" || s.status === "merged").length;
      const blocked = sessions.filter(isBlocked).length;
      const active = sessions.filter((s) => s.activity !== ACTIVITY_STATE.EXITED).length;
      const inProgress = Math.max(0, active - done - blocked);
      const total = sessions.length;
      const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;
      const activeRatio = total > 0 ? active / total : 0;

      let health: SprintEntry["health"] = "on-track";
      const healthReasons: string[] = [];
      const blockers: string[] = [];

      if (blocked >= 2) {
        health = "blocked";
        healthReasons.push(`${blocked} blocked agents`);
      } else if (blocked >= 1 || activeRatio < 0.3) {
        health = "at-risk";
        if (blocked >= 1) healthReasons.push(`${blocked} blocked agent`);
        if (activeRatio < 0.3) healthReasons.push("Low agent activity");
      }

      for (const s of sessions) {
        if (isBlocked(s)) {
          blockers.push(`${s.id} (${s.issueId ?? "no story"})`);
        }
      }

      entries.push({
        projectName: projects[pid]?.name ?? pid,
        sprintName: (projects[pid]?.name ?? pid) + " Sprint",
        progressPercent,
        status: active > 0 ? ("active" as const) : ("completed" as const),
        health,
        velocityTrend: "unknown" as const,
        stories: { total, done, inProgress, blocked, backlog: 0 },
        healthReasons: healthReasons.length > 0 ? healthReasons : undefined,
        blockers: blockers.length > 0 ? blockers : undefined,
      });
    }

    return entries;
  };
}

/**
 * Create a HealthProvider backed by core HealthCheckService.
 * Wraps createHealthCheckService() and maps results for Telegram.
 * Story 57.8 Task 4.
 */
function createHealthProvider(config: OrchestratorConfig): HealthProvider {
  const healthConfig: Parameters<typeof createHealthCheckService>[0] = {};

  // Load health config from YAML if available
  const healthYaml = (config as unknown as Record<string, unknown>).health as
    | Record<string, unknown>
    | undefined;
  if (healthYaml) {
    if (healthYaml.checkIntervalMs)
      healthConfig.checkIntervalMs = healthYaml.checkIntervalMs as number;
    if (healthYaml.alertOnTransition)
      healthConfig.alertOnTransition = healthYaml.alertOnTransition as boolean;
    if (healthYaml.thresholds) healthConfig.thresholds = healthYaml.thresholds as never;
  }

  // Cache the service instance so rate limiting / caching works across calls
  const service = createHealthCheckService(healthConfig);

  return async () => {
    const result = await service.check();

    return {
      overall: result.overall,
      components: result.components.map((c) => ({
        component: c.component,
        status: c.status,
        latencyMs: c.latencyMs,
        message: c.message,
        details: c.details,
      })),
      timestamp: result.timestamp.toISOString(),
      exitCode: result.exitCode,
      rateLimited: result.rateLimited,
    };
  };
}

/**
 * Create a ConflictsProvider backed by core ResourceConflictStore.
 * Reads stored conflicts (no re-scan) for fast response.
 * Story 57.9 Task 4.
 */
function createConflictsProvider(config: OrchestratorConfig): ConflictsProvider {
  // Determine config path for the conflict store
  const raw = (config as unknown as Record<string, unknown>).configPath;
  const configPath = typeof raw === "string" ? raw : "agent-orchestrator.yaml";
  const store = createResourceConflictStore(configPath);
  const projects = config.projects as Record<string, { name: string }>;

  return async (projectId?: string) => {
    const resolvedId = projectId
      ? (resolveProjectKey(projects, projectId) ?? projectId)
      : undefined;
    const conflicts = store.getActive();
    const filtered = resolvedId
      ? conflicts.filter((c) => c.competingProjects.includes(resolvedId))
      : conflicts;
    return filtered.map((c) => ({
      id: c.id,
      resourceType: c.resourceType,
      resourceIdentifier: c.resourceIdentifier,
      competingProjects: c.competingProjects,
      severity: c.severity,
      detectedAt: c.detectedAt,
    }));
  };
}

/**
 * Create a resume action handler that attempts to resume a blocked agent.
 * Returns user-friendly result text. Story 57.11 Task 6.
 */
function createResumeHandler(
  sessionManager: SessionManager,
): (targetId: string) => Promise<string> {
  return async (targetId: string) => {
    try {
      // SessionManager does not expose resume() directly; send a resume hint instead.
      // If BlockedAgentDetector becomes available via services, use detector.resume().
      await sessionManager.send(targetId, "resume");
      return `✅ Resume signal sent to ${targetId}`;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return `⚠️ Could not resume ${targetId}: ${reason}`;
    }
  };
}

/**
 * Create a dismiss action handler that acknowledges the notification.
 * Story 57.11 Task 6.
 */
function createDismissHandler(): (targetId: string) => Promise<string> {
  return async (_targetId: string) => "Acknowledged";
}

/**
 * Create an approve action handler that approves a pending approval request.
 * Returns user-friendly result text. Story 57.12 Task 5.
 */
function createApproveHandler(
  approvalService: ApprovalService,
): (targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string> {
  return async (targetId: string, _eventId?: string, userInfo?: CallbackUserInfo) => {
    try {
      const userId = userInfo?.username
        ? `@${userInfo.username}`
        : userInfo?.firstName
          ? userInfo.firstName
          : `telegram-${userInfo?.id ?? "unknown"}`;
      const result = approvalService.approve(targetId, userId);
      if (!result.success) {
        if (result.approval.status === "expired") return "Approval expired";
        if (result.approval.status === "approved" || result.approval.status === "rejected") {
          return "Already resolved";
        }
        return result.error ?? "Approval failed";
      }
      return `Approved by ${userId}\nAction: ${result.approval.action} — ${result.approval.target}`;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return `Approval failed: ${reason}`;
    }
  };
}

/**
 * Create a deny action handler that rejects a pending approval request.
 * Returns user-friendly result text. Story 57.12 Task 5.
 */
function createDenyHandler(
  approvalService: ApprovalService,
): (targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string> {
  return async (targetId: string, _eventId?: string, userInfo?: CallbackUserInfo) => {
    try {
      const userId = userInfo?.username
        ? `@${userInfo.username}`
        : userInfo?.firstName
          ? userInfo.firstName
          : `telegram-${userInfo?.id ?? "unknown"}`;
      const result = approvalService.reject(targetId, userId);
      if (!result.success) {
        if (result.approval.status === "expired") return "Approval expired";
        if (result.approval.status === "approved" || result.approval.status === "rejected") {
          return "Already resolved";
        }
        return result.error ?? "Deny failed";
      }
      return `Denied by ${userId}\nAction: ${result.approval.action} — ${result.approval.target}`;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return `Deny failed: ${reason}`;
    }
  };
}

/**
 * Parse a compound targetId of the form "storyId:param" into [storyId, param].
 * Story 57.13 Task 4.
 */
function parseCompoundTarget(targetId: string): [string, string | undefined] {
  const idx = targetId.indexOf(":");
  if (idx === -1) return [targetId, undefined];
  return [targetId.slice(0, idx), targetId.slice(idx + 1)];
}

/**
 * Resolve the first project that matches a story ID prefix (e.g. "49-1-" → project for epic 49).
 * Returns undefined if no match found.
 * Story 57.13 Task 4.
 */
function resolveProjectForStory(
  projects: Record<string, { name: string }>,
  storyId: string,
): { key: string; name: string } | undefined {
  // Story IDs look like "49-1-portfolio-dashboard-page-structure"
  // Extract the epic prefix (e.g. "49") and check against project configs
  const epicMatch = storyId.match(/^(\d+)/);
  if (!epicMatch) return undefined;
  for (const [key, proj] of Object.entries(projects)) {
    // Check if the project's tracker config references this epic
    const tracker = (proj as unknown as Record<string, unknown>).tracker as
      | Record<string, unknown>
      | undefined;
    if (
      tracker &&
      typeof tracker.epicPrefix === "string" &&
      tracker.epicPrefix.length > 0 &&
      epicMatch[1].startsWith(tracker.epicPrefix)
    ) {
      return { key, name: proj.name };
    }
  }
  // Fallback: return first project if only one exists
  const keys = Object.keys(projects);
  if (keys.length === 1) {
    return { key: keys[0], name: projects[keys[0]].name };
  }
  return undefined;
}

/**
 * Create a block action handler that sets a story status to "blocked".
 * Story 57.13 Task 4.
 */
function createBlockHandler(
  config: OrchestratorConfig,
): (targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string> {
  const projects = config.projects as Record<string, { name: string }>;
  return async (targetId: string, _eventId?: string, _userInfo?: CallbackUserInfo) => {
    try {
      const [storyId] = parseCompoundTarget(targetId);
      const proj = resolveProjectForStory(projects, storyId);
      if (!proj) return `Could not find project for story ${storyId}`;

      // Dynamic import to avoid pulling tracker-bmad at module level in test env
      const { writeStoryStatus } = await import("@composio/ao-plugin-tracker-bmad");
      writeStoryStatus(projects[proj.key] as never, storyId, "blocked");
      return `Status: blocked\nStory: ${storyId}`;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return `Could not block story: ${reason}`;
    }
  };
}

/**
 * Create an unblock action handler that sets a story status back to "in-progress".
 * Story 57.13 Task 4.
 */
function createUnblockHandler(
  config: OrchestratorConfig,
): (targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string> {
  const projects = config.projects as Record<string, { name: string }>;
  return async (targetId: string, _eventId?: string, _userInfo?: CallbackUserInfo) => {
    try {
      const [storyId] = parseCompoundTarget(targetId);
      const proj = resolveProjectForStory(projects, storyId);
      if (!proj) return `Could not find project for story ${storyId}`;

      const { writeStoryStatus } = await import("@composio/ao-plugin-tracker-bmad");
      writeStoryStatus(projects[proj.key] as never, storyId, "in-progress");
      return `Status: unblocked\nStory: ${storyId}`;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return `Could not unblock story: ${reason}`;
    }
  };
}

/**
 * Create a priority action handler that acknowledges a priority change.
 * targetId format: "storyId:level" where level is "high", "normal", or "low".
 * Story 57.13 Task 4.
 */
function createPriorityHandler(): (
  targetId: string,
  eventId?: string,
  userInfo?: CallbackUserInfo,
) => Promise<string> {
  return async (targetId: string, _eventId?: string, _userInfo?: CallbackUserInfo) => {
    try {
      const [storyId, level] = parseCompoundTarget(targetId);
      if (!level) return `Select priority for story ${storyId}`;
      // Priority acknowledged — not persisted to tracker (no writeStoryPriority API).
      // The priority level is captured in the callback data for audit trail.
      return `Priority: ${level}\nStory: ${storyId}`;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return `Could not set priority: ${reason}`;
    }
  };
}

/**
 * Create an assign action handler that acknowledges agent assignment.
 * targetId format: "storyId:agentId".
 * Story 57.13 Task 4.
 */
function createAssignHandler(
  config: OrchestratorConfig,
): (targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string> {
  const projects = config.projects as Record<string, { name: string }>;
  return async (targetId: string, _eventId?: string, _userInfo?: CallbackUserInfo) => {
    try {
      const [storyId, agentId] = parseCompoundTarget(targetId);
      if (!agentId) return `Select agent for story ${storyId}`;

      const proj = resolveProjectForStory(projects, storyId);
      if (!proj) return `Could not find project for story ${storyId}`;

      const { writeStoryAssignment } = await import("@composio/ao-plugin-tracker-bmad");
      writeStoryAssignment(projects[proj.key] as never, storyId, agentId);
      return `Assigned to ${agentId}\nStory: ${storyId}`;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      return `Could not assign agent: ${reason}`;
    }
  };
}

async function getBot() {
  if (!_bot) {
    const { getServices } = await import("@/lib/services");
    const { TelegramBot } = await import("@composio/ao-plugin-notifier-telegram");
    const services = await getServices();
    const telegramConfig = (services.config as unknown as Record<string, unknown>)?.notifiers as
      | Record<string, Record<string, unknown>>
      | undefined;
    const cfg = telegramConfig?.telegram;

    if (!cfg?.botToken) {
      throw new Error("Telegram bot not configured");
    }

    _bot = new TelegramBot({
      botToken: cfg.botToken as string,
      allowedChatIds: cfg.allowedChatIds as Array<number | string> | undefined,
      defaultChatId: cfg.defaultChatId as string | undefined,
      mode: "webhook",
      webhookUrl: cfg.webhookUrl as string | undefined,
      webhookSecret: cfg.webhookSecret as string | undefined,
      dashboardBaseUrl: cfg.dashboardBaseUrl as string | undefined,
    });
    _bot.installAuthMiddleware();
    _bot.registerStartCommand();
    _bot.registerStatusCommand(createStatusProvider(services.sessionManager, services.config));
    _bot.registerFleetCommand(createFleetProvider(services.sessionManager, services.config));
    _bot.registerSprintCommand(createSprintProvider(services.sessionManager, services.config));
    _bot.registerHealthCommand(createHealthProvider(services.config));
    _bot.registerConflictsCommand(createConflictsProvider(services.config));
    _bot.registerSetProjectCommand(createProjectListProvider(services.config));
    _bot.registerCancelCommand();
    _bot.registerSpawnCommand(
      createProjectListProvider(services.config),
      () => [], // AgentListProvider — placeholder until SessionManager integration
    );
    _bot.registerCallbackHandler({
      resume: createResumeHandler(services.sessionManager),
      dismiss: createDismissHandler(),
      approve: createApproveHandler(sharedApprovalService),
      deny: createDenyHandler(sharedApprovalService),
      block: createBlockHandler(services.config),
      unblock: createUnblockHandler(services.config),
      priority: createPriorityHandler(),
      assign: createAssignHandler(services.config),
    } satisfies Partial<
      Record<
        CallbackAction,
        (targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string>
      >
    >);
    _webhookSecret = (cfg.webhookSecret as string) ?? null;
  }
  return { bot: _bot, secret: _webhookSecret };
}

export async function POST(request: NextRequest) {
  // Validate secret token header
  const { bot, secret } = await getBot();

  if (secret) {
    const headerSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Parse and handle the update
  try {
    const update = await request.json();

    // Basic shape validation — Telegram updates always have update_id
    if (!update || typeof update !== "object" || typeof update.update_id !== "number") {
      return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
    }

    await bot.handleUpdate(update);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[notifier-telegram] Webhook processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
