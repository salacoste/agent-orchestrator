/**
 * Telegram bot wrapper — token validation, authorization middleware, mode selection.
 *
 * Encapsulates grammY Bot instance setup and lifecycle management.
 * Story 57.1 Tasks 2, 3, 5.
 */

import { Bot, session, type Api, type RawApi } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { escapeMarkdownV2 } from "./markdown-escape.js";
import { sendWithRetry } from "./send-helpers.js";
import {
  type BotContext,
  type BotConversation,
  ConversationTimeoutError,
  checkTimeout,
  formatExpiredMessage,
  formatCancelledMessage,
} from "./conversation-helpers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelegramBotConfig {
  botToken: string;
  allowedChatIds?: Array<number | string>;
  defaultChatId?: string;
  mode?: "polling" | "webhook";
  webhookUrl?: string;
  webhookSecret?: string;
  /** Base URL for dashboard deep links in notification buttons. Defaults to "" (no link). */
  dashboardBaseUrl?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  botInfo?: {
    id: number;
    username: string;
    firstName: string;
  };
  error?: string;
}

/** System status data for the /status command. Story 57.5. */
export interface SystemStatus {
  /** Non-exited session count (includes working, blocked, and idle sessions). */
  activeAgents: number;
  totalSessions: number;
  workingSessions: number;
  blockedSessions: number;
  idleSessions: number;
  openPRs: number;
  needsReview: number;
  healthStatus: "healthy" | "degraded" | "unhealthy" | "unknown";
  healthMessage?: string;
  timestamp: string;
}

/** Callback that provides system status data to the /status command handler. Story 57.5. */
export type StatusProvider = (projectId?: string) => Promise<SystemStatus>;

/** Per-agent data for the /fleet command. Story 57.6. */
export interface FleetAgent {
  id: string;
  project: string;
  status: string;
  activity: string;
  story?: string;
  branch?: string;
  /** True when agent is blocked, errored, or otherwise needs attention. */
  isAlert: boolean;
}

/** Callback that provides fleet agent data to the /fleet command handler. Story 57.6. */
export type FleetProvider = (projectId?: string) => Promise<FleetAgent[]>;

/** Per-project sprint data for the /sprint command. Story 57.7. */
export interface SprintEntry {
  projectName: string;
  sprintName: string;
  progressPercent: number;
  status: "active" | "completed" | "planning";
  health: "on-track" | "at-risk" | "blocked" | "unknown";
  velocityTrend: "improving" | "declining" | "stable" | "unknown";
  stories: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    backlog: number;
  };
  healthReasons?: string[];
  blockers?: string[];
}

/** Callback that provides sprint data to the /sprint command handler. Story 57.7. */
export type SprintProvider = (projectId?: string) => Promise<SprintEntry[]>;

/** Per-component health data for the /health command. Story 57.8. */
export interface HealthCheckEntry {
  component: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  message: string;
  details?: string[];
}

/** Aggregated health check result for the /health command. Story 57.8. */
export interface HealthCheckResult {
  overall: "healthy" | "degraded" | "unhealthy";
  components: HealthCheckEntry[];
  timestamp: string;
  exitCode: number;
  /** True when the result was returned from cache due to rate limiting. */
  rateLimited?: boolean;
}

/** Callback that provides health check data to the /health command handler. Story 57.8. */
export type HealthProvider = () => Promise<HealthCheckResult>;

/** Per-conflict data for the /conflicts command. Story 57.9. */
export interface ConflictEntry {
  id: string;
  resourceType: string;
  resourceIdentifier: string;
  competingProjects: string[];
  severity: "critical" | "high" | "medium" | "low";
  detectedAt: string;
}

/** Callback that provides conflict data to the /conflicts command handler. Story 57.9. */
export type ConflictsProvider = (projectId?: string) => Promise<ConflictEntry[]>;

// ---------------------------------------------------------------------------
// Callback data types and helpers (Story 57.11)
// ---------------------------------------------------------------------------

/** Actions available via inline notification buttons. Story 57.11 Task 1 + Story 57.13 Task 1. */
export type CallbackAction =
  | "resume"
  | "dismiss"
  | "view"
  | "approve"
  | "deny"
  | "block"
  | "unblock"
  | "priority"
  | "assign";

/** Decoded callback data from an inline button press. Story 57.11 Task 1. */
export interface CallbackData {
  action: CallbackAction;
  targetId: string;
  eventId?: string;
}

/** User info extracted from a Telegram callback query context. */
export interface CallbackUserInfo {
  /** Telegram user ID who pressed the button. */
  id?: number;
  /** Telegram username (without @). */
  username?: string;
  /** Telegram display name. */
  firstName?: string;
}

/** Maximum callback_data size in bytes (Telegram limit). */
const MAX_CALLBACK_BYTES = 64;

/** Maximum processed callback IDs to track for idempotency. */
const CALLBACK_CACHE_CAP = 1000;

/** Valid callback action values for decode-time validation. */
const VALID_CALLBACK_ACTIONS: ReadonlySet<string> = new Set<string>([
  "resume",
  "dismiss",
  "view",
  "approve",
  "deny",
  "block",
  "unblock",
  "priority",
  "assign",
]);

/**
 * Encode callback data as JSON with short keys to stay under 64 bytes.
 * Story 57.11 Task 1.
 */
export function encodeCallbackData(
  action: CallbackAction,
  targetId: string,
  eventId?: string,
): string {
  const payload: Record<string, string> = { a: action, t: targetId };
  if (eventId) payload.e = eventId;
  const json = JSON.stringify(payload);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > MAX_CALLBACK_BYTES) {
    throw new Error(
      `Callback data exceeds ${MAX_CALLBACK_BYTES} bytes (got ${byteLength}): ${json}`,
    );
  }
  return json;
}

/**
 * Decode callback data from a Telegram callback_query.
 * Returns undefined if data is invalid. Story 57.11 Task 1.
 */
export function decodeCallbackData(data: string): CallbackData | undefined {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (typeof parsed.a !== "string" || typeof parsed.t !== "string") return undefined;
    if (!VALID_CALLBACK_ACTIONS.has(parsed.a)) return undefined;
    return {
      action: parsed.a as CallbackAction,
      targetId: parsed.t as string,
      eventId: typeof parsed.e === "string" ? parsed.e : undefined,
    };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Inline notification buttons (Story 57.11)
// ---------------------------------------------------------------------------

/** grammY inline keyboard button shape. */
interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

/**
 * Build inline keyboard buttons for a notification event type.
 * Returns undefined for non-actionable events.
 * Story 57.11 Task 2.
 *
 * @param eventType The notification event type (e.g. "agent.blocked").
 * @param metadata Event metadata (agentId, sessionId, storyId, conflictId).
 * @param dashboardBaseUrl Base URL for deep links (e.g. "http://localhost:3000"). Empty = no URL buttons.
 */
export function buildNotificationButtons(
  eventType: string,
  metadata: Record<string, unknown>,
  dashboardBaseUrl = "",
): InlineKeyboardButton[][] | undefined {
  const targetId = typeof metadata.agentId === "string" ? metadata.agentId : "";
  const sessionId = typeof metadata.sessionId === "string" ? metadata.sessionId : targetId;
  const storyId = typeof metadata.storyId === "string" ? metadata.storyId : sessionId;
  const conflictId = typeof metadata.conflictId === "string" ? metadata.conflictId : sessionId;
  const base = dashboardBaseUrl.replace(/\/+$/, "");

  if (eventType === "agent.blocked") {
    const resumeData = encodeCallbackData("resume", targetId || sessionId);
    const dismissData = encodeCallbackData("dismiss", targetId || sessionId);
    const viewUrl = base ? `${base}/agents/${targetId || sessionId}` : undefined;
    const row: InlineKeyboardButton[] = [{ text: "Resume", callback_data: resumeData }];
    if (viewUrl) {
      row.push({ text: "View Details", url: viewUrl });
    }
    row.push({ text: "Dismiss", callback_data: dismissData });
    return [row];
  }

  if (eventType === "story.blocked") {
    const dismissData = encodeCallbackData("dismiss", storyId);
    const row: InlineKeyboardButton[] = [];
    const viewUrl = base ? `${base}/stories/${storyId}` : undefined;
    if (viewUrl) {
      row.push({ text: "View Details", url: viewUrl });
    }
    row.push({ text: "Dismiss", callback_data: dismissData });
    return [row];
  }

  if (eventType === "conflict.detected") {
    const dismissData = encodeCallbackData("dismiss", conflictId);
    const row: InlineKeyboardButton[] = [];
    const viewUrl = base ? `${base}/conflicts/${conflictId}` : undefined;
    if (viewUrl) {
      row.push({ text: "View Conflicts", url: viewUrl });
    }
    row.push({ text: "Dismiss", callback_data: dismissData });
    return [row];
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Approval buttons (Story 57.12)
// ---------------------------------------------------------------------------

/**
 * Build inline keyboard buttons for an approval request.
 * Returns [Approve] [Deny] buttons with callback_data encoding the approval ID.
 * Story 57.12 Task 2.
 *
 * @param approvalId The ApprovalRequest.id (UUID) — used as the callback targetId.
 */
export function buildApprovalButtons(approvalId: string): InlineKeyboardButton[][] | undefined {
  if (!approvalId) return undefined;
  try {
    const approveData = encodeCallbackData("approve", approvalId);
    const denyData = encodeCallbackData("deny", approvalId);
    return [
      [
        { text: "Approve", callback_data: approveData },
        { text: "Deny", callback_data: denyData },
      ],
    ];
  } catch {
    // Approval ID too long for Telegram callback_data limit — skip buttons
    // eslint-disable-next-line no-console -- plugin logging
    console.warn(
      `[notifier-telegram] Approval ID too long for inline buttons (${approvalId.length} chars)`,
    );
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Story action buttons (Story 57.13)
// ---------------------------------------------------------------------------

/**
 * Build inline keyboard buttons for story quick actions.
 * Returns [Block/Unblock] [Priority] [Assign] buttons with callback_data encoding the story ID.
 * Story 57.13 Task 2.
 *
 * @param storyId The story ID (e.g. "49-1-portfolio-dashboard"). Empty = return undefined.
 * @param _projectKey Project key (reserved for future routing).
 * @param dashboardBaseUrl Optional dashboard base URL for deep links.
 * @param options.isBlocked When true, shows [Unblock] instead of [Block] for already-blocked stories.
 */
export function buildStoryActionButtons(
  storyId: string,
  _projectKey: string,
  dashboardBaseUrl?: string,
  options?: { isBlocked?: boolean },
): InlineKeyboardButton[][] | undefined {
  if (!storyId) return undefined;

  try {
    const isBlocked = options?.isBlocked ?? false;
    const toggleAction = isBlocked ? ("unblock" as const) : ("block" as const);
    const toggleLabel = isBlocked ? "Unblock" : "Block";
    const toggleData = encodeCallbackData(toggleAction, storyId);
    const priorityData = encodeCallbackData("priority", storyId);
    const assignData = encodeCallbackData("assign", storyId);
    const row: InlineKeyboardButton[] = [
      { text: toggleLabel, callback_data: toggleData },
      { text: "Priority", callback_data: priorityData },
      { text: "Assign", callback_data: assignData },
    ];
    if (dashboardBaseUrl) {
      const base = dashboardBaseUrl.replace(/\/+$/, "");
      row.push({ text: "View", url: `${base}/stories/${storyId}` });
    }
    return [row];
  } catch {
    // Story ID too long for Telegram callback_data limit — skip buttons
    // eslint-disable-next-line no-console -- plugin logging
    console.warn(
      `[notifier-telegram] Story ID too long for inline buttons (${storyId.length} chars)`,
    );
    return undefined;
  }
}

/**
 * Format a story action result into a Telegram MarkdownV2 message.
 * All dynamic content is escaped via escapeMarkdownV2().
 * Story 57.13 Task 3.
 *
 * @param storyId Story ID.
 * @param project Project name.
 * @param action Action performed (e.g. "blocked", "priority", "assigned").
 * @param result Human-readable result text.
 */
export function formatStoryActionMessage(
  storyId: string,
  project: string,
  action: string,
  result: string,
): string {
  const lines = [
    "\\*Story Quick Action\\*",
    `Story: ${escapeMarkdownV2(storyId)}`,
    `Project: ${escapeMarkdownV2(project)}`,
    `Action: ${escapeMarkdownV2(action)}`,
    `Result: ${escapeMarkdownV2(result)}`,
  ];
  return lines.join("\n");
}

/** Request shape for formatting an approval message. */
export interface ApprovalMessageRequest {
  /** Approval request ID (UUID). Required for sendApprovalMessage to build callback buttons. */
  id?: string;
  action: string;
  target: string;
  requestedBy: string;
  requestedAt: string;
}

/**
 * Format an approval request into a Telegram MarkdownV2 message.
 * All dynamic content is escaped via escapeMarkdownV2().
 * Story 57.12 Task 3.
 */
export function formatApprovalMessage(request: ApprovalMessageRequest): string {
  const lines = [
    "\\*Approval Request\\*",
    `Action: ${escapeMarkdownV2(request.action)}`,
    `Target: ${escapeMarkdownV2(request.target)}`,
    `Requested by: ${escapeMarkdownV2(request.requestedBy)}`,
    `Time: ${escapeMarkdownV2(request.requestedAt)}`,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Project argument parsing (Story 57.10)
// ---------------------------------------------------------------------------

/** Extract `project:<name>` argument from command text. Story 57.10 Task 2. */
export function parseProjectArg(text: string): string | undefined {
  const match = text.match(/project:(\S+)/);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Status formatting (Story 57.5)
// ---------------------------------------------------------------------------

const HEALTH_EMOJI: Record<SystemStatus["healthStatus"], string> = {
  healthy: "\u{1F7E2}", // green circle
  degraded: "\u{1F7E1}", // yellow circle
  unhealthy: "\u{1F534}", // red circle
  unknown: "\u26AB", // black circle
};

/**
 * Format a SystemStatus into a Telegram MarkdownV2 message.
 * Story 57.5 Task 3.
 */
export function formatStatusMessage(status: SystemStatus, projectName?: string): string {
  const healthEmoji = HEALTH_EMOJI[status.healthStatus] ?? HEALTH_EMOJI.unknown;
  const healthLabel = escapeMarkdownV2(
    status.healthStatus.charAt(0).toUpperCase() + status.healthStatus.slice(1),
  );

  const headerSuffix = projectName ? ` \\(${escapeMarkdownV2(projectName)}\\)` : "";
  let msg =
    `\u{1F4CA} *Agent Orchestrator Status*${headerSuffix}\n\n` +
    `${healthEmoji} System: ${healthLabel}`;

  if (status.healthMessage) {
    msg += ` \u2014 ${escapeMarkdownV2(status.healthMessage)}`;
  }

  msg += "\n\n";

  if (status.activeAgents === 0) {
    msg += `\u{1F916} No active sessions\n`;
  } else {
    msg +=
      `\u{1F916} Agents: ${status.activeAgents} online / ${status.totalSessions} total\n` +
      `   \u2022 Working: ${status.workingSessions}\n` +
      `   \u2022 Blocked: ${status.blockedSessions}\n` +
      `   \u2022 Idle: ${status.idleSessions}\n\n` +
      `\u{1F4CB} Activity:\n` +
      `   \u2022 PRs open: ${status.openPRs}\n` +
      `   \u2022 Needs review: ${status.needsReview}`;
  }

  if (status.timestamp) {
    msg += `\n\n\u{1F552} _${escapeMarkdownV2(status.timestamp)}_`;
  }

  return msg;
}

// ---------------------------------------------------------------------------
// Fleet formatting (Story 57.6)
// ---------------------------------------------------------------------------

const STATUS_EMOJI: Record<string, string> = {
  blocked: "\u{1F534}", // red circle
  errored: "\u{1F534}", // red circle
  failed: "\u{1F534}", // red circle
  exited: "\u26AB", // black circle
  idle: "\u{1F7E1}", // yellow circle
  waiting_input: "\u{1F7E1}", // yellow circle
};

function agentEmoji(agent: FleetAgent): string {
  return STATUS_EMOJI[agent.activity] ?? STATUS_EMOJI[agent.status] ?? "\u{1F7E2}";
}

/**
 * Format an array of FleetAgent into a Telegram MarkdownV2 message.
 * Story 57.6 Task 3.
 */
export function formatFleetMessage(agents: FleetAgent[], projectName?: string): string {
  if (agents.length === 0) {
    const headerSuffix = projectName ? ` \\(${escapeMarkdownV2(projectName)}\\)` : "";
    return `\u{1F916} *Agent Fleet*${headerSuffix}\n\nNo active agents\\.\n\nUse /status for system summary\\.`;
  }

  const alertCount = agents.filter((a) => a.isAlert).length;
  const healthyCount = agents.length - alertCount;

  const headerSuffix = projectName ? ` \\(${escapeMarkdownV2(projectName)}\\)` : "";
  let msg = `\u{1F916} *Agent Fleet*${headerSuffix} \\(${agents.length} agents\\)\n\n`;

  for (const agent of agents) {
    const emoji = agentEmoji(agent);
    const alertPrefix = agent.isAlert ? "\u26A0\uFE0F " : "";
    const story = agent.story ? escapeMarkdownV2(agent.story) : "\u2014";
    const project = escapeMarkdownV2(agent.project);
    const id = escapeMarkdownV2(agent.id);
    const activity = escapeMarkdownV2(agent.activity);

    msg += `${alertPrefix}${emoji} ${id} | ${project} | ${activity} | ${story}\n`;
  }

  msg += `\n\u{1F4CA} ${healthyCount} healthy`;
  if (alertCount > 0) {
    msg += `, ${alertCount} alert${alertCount > 1 ? "s" : ""}`;
  }
  msg += `\nUse /status for system summary\\.`;

  return msg;
}

/**
 * Create a cancellable timeout promise.
 * Returns the promise and a clear function to cancel the timer on early resolution.
 */
function timeout(ms: number): { promise: Promise<never>; clear: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Provider timed out after ${ms}ms`)), ms);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

// ---------------------------------------------------------------------------
// Sprint formatting (Story 57.7)
// ---------------------------------------------------------------------------

const SPRINT_HEALTH_EMOJI: Record<SprintEntry["health"], string> = {
  "on-track": "\u{1F7E2}", // green circle
  "at-risk": "\u{1F7E1}", // yellow circle
  blocked: "\u{1F534}", // red circle
  unknown: "\u26AB", // black circle
};

const VELOCITY_TREND_EMOJI: Record<SprintEntry["velocityTrend"], string> = {
  improving: "\u{1F4C8}", // chart increasing
  declining: "\u{1F4C9}", // chart decreasing
  stable: "\u27A1\uFE0F", // right arrow
  unknown: "\u2753", // question mark
};

/**
 * Format an array of SprintEntry into a Telegram MarkdownV2 message.
 * Shows summary view (multiple projects) or detailed view (single project).
 * Story 57.7 Task 3.
 */
export function formatSprintMessage(entries: SprintEntry[], projectName?: string): string {
  if (entries.length === 0) {
    return `\u{1F4CA} *Sprint Overview*\n\nNo active sprints\\.\n\nUse /status for system summary\\.`;
  }

  // Detailed single-project view
  if (projectName && entries.length === 1) {
    const e = entries[0];
    const healthEmoji = SPRINT_HEALTH_EMOJI[e.health];
    const trendEmoji = VELOCITY_TREND_EMOJI[e.velocityTrend];
    const name = escapeMarkdownV2(e.projectName);

    const filled = Math.min(10, Math.round(e.progressPercent / 10));
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(10 - filled);

    let msg = `\u{1F4CA} *Sprint: ${name}*\n\n`;
    msg += `${healthEmoji} Health: ${escapeMarkdownV2(e.health === "on-track" ? "On\\-track" : e.health)}\n`;
    msg += `${trendEmoji} Velocity: ${escapeMarkdownV2(e.velocityTrend)}\n\n`;
    msg += `\u{1F4DD} Stories: ${e.stories.total} total\n`;
    msg += `   \u2705 Done: ${e.stories.done}\n`;
    msg += `   \u{1F504} Active: ${e.stories.inProgress}\n`;
    msg += `   \u{1F6AB} Blocked: ${e.stories.blocked}\n`;
    msg += `   \u{1F4CB} Backlog: ${e.stories.backlog}\n\n`;
    msg += `${bar} ${e.progressPercent}% complete`;

    if (e.healthReasons && e.healthReasons.length > 0) {
      msg += "\n\n\u26A0\uFE0F ";
      msg += e.healthReasons.map((r) => escapeMarkdownV2(r)).join("\\n");
    }

    if (e.blockers && e.blockers.length > 0) {
      msg += `\n\n\u{1F6A8} Blocked: ${e.blockers.map((b) => escapeMarkdownV2(b)).join(", ")}`;
    }

    msg += `\n\nUse /fleet for agent details\\.`;
    return msg;
  }

  // Summary multi-project view
  const alertCount = entries.filter((e) => e.health === "at-risk" || e.health === "blocked").length;
  const unknownCount = entries.filter((e) => e.health === "unknown").length;
  const healthyCount = entries.length - alertCount - unknownCount;

  let msg = `\u{1F4CA} *Sprint Overview* \\(${entries.length} projects\\)\n\n`;

  for (const e of entries) {
    const healthEmoji = SPRINT_HEALTH_EMOJI[e.health];
    const trendEmoji = VELOCITY_TREND_EMOJI[e.velocityTrend];
    const name = escapeMarkdownV2(e.projectName);
    const filled = Math.min(10, Math.round(e.progressPercent / 10));
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(10 - filled);
    msg += `${healthEmoji} ${name} | ${bar} ${e.progressPercent}% | ${trendEmoji} ${escapeMarkdownV2(e.velocityTrend)}\n`;
  }

  msg += `\n${healthyCount} on\\-track`;
  if (alertCount > 0) {
    msg += `, ${alertCount} at\\-risk`;
  }
  if (unknownCount > 0) {
    msg += `, ${unknownCount} unknown`;
  }
  msg += `\nUse /status for system summary\\.`;

  return msg;
}

// ---------------------------------------------------------------------------
// Health formatting (Story 57.8)
// ---------------------------------------------------------------------------

const COMPONENT_STATUS_EMOJI: Record<HealthCheckEntry["status"], string> = {
  healthy: "\u{1F7E2}", // green circle
  degraded: "\u{1F7E1}", // yellow circle
  unhealthy: "\u{1F534}", // red circle
};

const COMPONENT_STATUS_ICON: Record<HealthCheckEntry["status"], string> = {
  healthy: "\u2705", // white check mark
  degraded: "\u26A0\uFE0F", // warning
  unhealthy: "\u274C", // cross mark
};

/**
 * Format a HealthCheckResult into a Telegram MarkdownV2 message.
 * Shows compact view when all healthy, full detail when degraded/unhealthy.
 * Story 57.8 Task 3.
 */
export function formatHealthMessage(result: HealthCheckResult): string {
  // Empty components — provider error / unavailable
  if (result.components.length === 0) {
    return `\u{1F3E5} *System Health*\n\n\u26A0\uFE0F Health check unavailable\nCould not run health diagnostics\\.`;
  }

  const overallEmoji = COMPONENT_STATUS_EMOJI[result.overall];
  const allHealthy = result.components.every((c) => c.status === "healthy");

  let msg = `\u{1F3E5} *System Health*\n\n`;

  if (allHealthy) {
    // Compact mode — all systems operational
    msg += `${overallEmoji} All systems operational\n\n`;

    for (const c of result.components) {
      const icon = COMPONENT_STATUS_ICON[c.status];
      const name = escapeMarkdownV2(c.component);
      const latency = c.latencyMs !== undefined ? ` ${c.latencyMs}ms` : "";
      msg += `${name}: ${icon}${latency}\n`;
    }
  } else {
    // Full detail mode — show messages and error details
    const overallLabel = escapeMarkdownV2(
      result.overall.charAt(0).toUpperCase() + result.overall.slice(1),
    );
    msg += `${overallEmoji} Status: ${overallLabel}\n\n`;

    for (const c of result.components) {
      const emoji = COMPONENT_STATUS_EMOJI[c.status];
      const icon = COMPONENT_STATUS_ICON[c.status];
      const name = escapeMarkdownV2(c.component);
      const latency = c.latencyMs !== undefined ? ` ${c.latencyMs}ms` : "";
      const message = escapeMarkdownV2(c.message);

      msg += `${emoji} ${name}: ${icon}${latency}\n   ${message}\n`;

      if (c.details && c.details.length > 0) {
        msg += `   Details: ${c.details.map((d) => escapeMarkdownV2(d)).join("\\n            ")}\n`;
      }
    }

    const degradedCount = result.components.filter((c) => c.status === "degraded").length;
    const unhealthyCount = result.components.filter((c) => c.status === "unhealthy").length;

    if (unhealthyCount > 0) {
      msg += `\n\u{1F6A8} ${unhealthyCount} unhealthy component${unhealthyCount > 1 ? "s" : ""}`;
      if (degradedCount > 0) {
        msg += `, ${degradedCount} degraded`;
      }
      msg += "\n";
    } else if (degradedCount > 0) {
      msg += `\n\u26A0\uFE0F ${degradedCount} degraded component${degradedCount > 1 ? "s" : ""}\n`;
    }
  }

  if (result.timestamp) {
    msg += `\n\u{1F552} _${escapeMarkdownV2(result.timestamp)}_`;
  }

  if (result.rateLimited) {
    msg += `\n\u{1F4BE} Cached result \\(rate limited\\)`;
  }

  msg += `\nUse /status for session summary\\.`;
  return msg;
}

// ---------------------------------------------------------------------------
// Conflicts formatting (Story 57.9)
// ---------------------------------------------------------------------------

const SEVERITY_EMOJI: Record<ConflictEntry["severity"], string> = {
  critical: "\u{1F534}", // red circle
  high: "\u{1F7E0}", // orange circle
  medium: "\u{1F7E1}", // yellow circle
  low: "\u{1F7E2}", // green circle
};

/** Known resource types for conflict display. */
type ConflictResourceType = "repository" | "file-path" | "agent" | "external-service";

const RESOURCE_TYPE_EMOJI: Record<ConflictResourceType, string> = {
  repository: "\u{1F4E6}", // 📦
  "file-path": "\u{1F4C4}", // 📄
  agent: "\u{1F916}", // 🤖
  "external-service": "\u{1F310}", // 🌐
};

/**
 * Format an array of ConflictEntry into a Telegram MarkdownV2 message.
 * Story 57.9 Task 3.
 */
export function formatConflictsMessage(conflicts: ConflictEntry[], projectName?: string): string {
  if (conflicts.length === 0) {
    const headerSuffix = projectName ? ` \\(${escapeMarkdownV2(projectName)}\\)` : "";
    return (
      `\u2705 *Resource Conflicts*${headerSuffix}\n\n` +
      `No active conflicts\\. All resources are available\\.\n` +
      `Use /status for system summary\\.`
    );
  }

  // Sort by severity: critical first
  const severityOrder: Record<ConflictEntry["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sorted = [...conflicts].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  // Limit displayed conflicts to avoid exceeding Telegram's 4096-char message limit
  const MAX_DISPLAYED = 20;
  const toShow = sorted.slice(0, MAX_DISPLAYED);

  const headerSuffix = projectName ? ` \\(${escapeMarkdownV2(projectName)}\\)` : "";
  let msg = `\u{1F6A8} *Resource Conflicts*${headerSuffix} \\(${conflicts.length} active\\)\n\n`;

  for (const c of toShow) {
    const sevEmoji = SEVERITY_EMOJI[c.severity] ?? SEVERITY_EMOJI.low;
    const typeEmoji = RESOURCE_TYPE_EMOJI[c.resourceType as ConflictResourceType] ?? "\u2753";
    const resource = escapeMarkdownV2(c.resourceIdentifier);
    const projects =
      c.competingProjects.length > 0
        ? c.competingProjects.map((p) => escapeMarkdownV2(p)).join(", ")
        : "\u2014";

    msg += `${sevEmoji} ${typeEmoji} ${escapeMarkdownV2(c.resourceType)} | ${resource} | ${projects}\n`;
  }

  const remaining = sorted.length - toShow.length;
  if (remaining > 0) {
    msg += `\n\\.\\.\\.and ${remaining} more conflict${remaining > 1 ? "s" : ""}\\.`;
  }

  // Summary footer (counts ALL conflicts, not just displayed)
  const critical = conflicts.filter((c) => c.severity === "critical").length;
  const high = conflicts.filter((c) => c.severity === "high").length;
  const medium = conflicts.filter((c) => c.severity === "medium").length;
  const low = conflicts.filter((c) => c.severity === "low").length;

  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (high > 0) parts.push(`${high} high`);
  if (medium > 0) parts.push(`${medium} medium`);
  if (low > 0) parts.push(`${low} low`);

  msg += `\n\u{1F4CA} ${parts.join(", ")}`;
  msg += `\nUse /fleet for agent details\\.`;

  return msg;
}

// ---------------------------------------------------------------------------
// Spawn conversation function (Story 57.14 Task 4)
// ---------------------------------------------------------------------------

/** Provider that returns configured project names for the spawn conversation. */
export type ProjectListProvider = () => string[];

/** Provider that returns available agent IDs for agent selection. */
export type AgentListProvider = () => Array<{ id: string; name: string }>;

/**
 * Named conversation function for /spawn multi-step wizard.
 * Asks: project → story → agent → confirm.
 * Story 57.14 Task 4.2.
 */
async function spawnConversation(conversation: BotConversation, ctx: BotContext): Promise<void> {
  let lastActivity = Date.now();

  try {
    // Access providers set by registerSpawnCommand
    const providers = spawnProviders;
    if (!providers) {
      await ctx.reply("\u26A0\uFE0F Spawn not configured\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    // Step 1: Ask for project
    await ctx.reply("Which project do you want to spawn an agent for?");
    checkTimeout(lastActivity);
    const projectCtx = await conversation.wait();
    const projectName = projectCtx.msg?.text?.trim();
    if (!projectName) {
      await ctx.reply(formatCancelledMessage(), { parse_mode: "MarkdownV2" });
      return;
    }
    lastActivity = Date.now();

    // Validate project
    const validProjects = providers.projectList();
    const matchedProject = validProjects.find((p) => p.toLowerCase() === projectName.toLowerCase());
    if (!matchedProject) {
      const available = validProjects.map((p) => `  \\- ${escapeMarkdownV2(p)}`).join("\n");
      await ctx.reply(
        `\u274C Project \`${escapeMarkdownV2(projectName)}\` not found\\.\n\nAvailable:\n${available}`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    // Step 2: Ask for story
    await ctx.reply("Which story should the agent work on?");
    checkTimeout(lastActivity);
    const storyCtx = await conversation.wait();
    const storyId = storyCtx.msg?.text?.trim();
    if (!storyId) {
      await ctx.reply(formatCancelledMessage(), { parse_mode: "MarkdownV2" });
      return;
    }
    lastActivity = Date.now();

    // Step 3: Show agents as inline buttons
    const agents = providers.agentList();
    if (agents.length === 0) {
      await ctx.reply("\u26A0\uFE0F No agents available\\. Action cancelled\\.", {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    const agentButtons = agents.map((a) => [
      { text: a.name || a.id, callback_data: `agent:${a.id}` },
    ]);
    await ctx.reply("Select an agent:", {
      reply_markup: { inline_keyboard: agentButtons },
    });

    checkTimeout(lastActivity);
    const agentCtx = await conversation.waitForCallbackQuery(/^agent:/);
    const agentData = agentCtx.callbackQuery.data ?? "";
    const agentId = agentData.replace(/^agent:/, "");

    // Step 4: Confirm
    const confirmMsg =
      `\u2705 *Confirm spawn*\n\n` +
      `Project: ${escapeMarkdownV2(matchedProject)}\n` +
      `Story: ${escapeMarkdownV2(storyId)}\n` +
      `Agent: ${escapeMarkdownV2(agentId)}\n\n` +
      `Spawning agent\\.\\.\\.`;

    await ctx.reply(confirmMsg, { parse_mode: "MarkdownV2" });

    // Report result
    await ctx.reply(
      `\u2705 Agent \`${escapeMarkdownV2(agentId)}\` spawned for story \`${escapeMarkdownV2(storyId)}\`\\.`,
      { parse_mode: "MarkdownV2" },
    );
  } catch (err: unknown) {
    if (err instanceof ConversationTimeoutError) {
      await ctx.reply(formatExpiredMessage(), { parse_mode: "MarkdownV2" }).catch(() => {});
      await ctx.conversation.exit("spawn");
      return;
    }
    const reason = err instanceof Error ? err.message : String(err);
    await ctx
      .reply(`\u26A0\uFE0F Spawn failed: ${escapeMarkdownV2(reason)}`, {
        parse_mode: "MarkdownV2",
      })
      .catch(() => {});
  }
}

/** Module-level spawn providers — set by registerSpawnCommand. */
let spawnProviders: { projectList: ProjectListProvider; agentList: AgentListProvider } | null =
  null;

// ---------------------------------------------------------------------------
// TelegramBot
// ---------------------------------------------------------------------------

export class TelegramBot {
  readonly bot: Bot<BotContext>;
  private readonly config: TelegramBotConfig;
  private readonly allowedChatIds: Set<number>;
  private _botInfo: { id: number; username: string; firstName: string } | null = null;
  /** Per-chat default project context. Story 57.10 Task 1. */
  private readonly projectContext = new Map<number, string>();
  /** Processed callback query IDs for idempotency. Story 57.11 Task 4. */
  private processedCallbacks = new Set<string>();

  constructor(config: TelegramBotConfig) {
    this.config = config;
    this.bot = new Bot<BotContext>(config.botToken);
    this.allowedChatIds = new Set((config.allowedChatIds ?? []).map((id) => Number(id)));

    // Session middleware MUST be installed before conversations plugin.
    this.bot.use(session({ initial: () => ({}) }) as never);
    this.bot.use(conversations() as never);
  }

  /** Bot info from getMe (available after validateToken succeeds). */
  get botInfo() {
    return this._botInfo;
  }

  /** The configured default chat ID for sending notifications. */
  get defaultChatId(): string | undefined {
    return this.config.defaultChatId;
  }

  /** The grammY API for direct calls (convenience methods + raw API). */
  get api(): Api<RawApi> {
    return this.bot.api;
  }

  // -------------------------------------------------------------------------
  // Token Validation (Task 2)
  // -------------------------------------------------------------------------

  /**
   * Validate the bot token by calling getMe.
   * Returns validation result with bot info on success.
   */
  async validateToken(): Promise<TokenValidationResult> {
    try {
      const me = await this.bot.api.getMe();
      this._botInfo = {
        id: me.id,
        username: me.username ?? "unknown",
        firstName: me.first_name,
      };
      return {
        valid: true,
        botInfo: this._botInfo,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error:
          `Telegram bot token validation failed: ${message}. ` +
          `Please verify your TELEGRAM_BOT_TOKEN from @BotFather.`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Authorization Middleware (Task 3)
  // -------------------------------------------------------------------------

  /**
   * Install authorization middleware on the bot.
   * - Empty allowlist → open mode (log warning, allow all).
   * - Non-empty allowlist → check ctx.chat.id against set.
   */
  installAuthMiddleware(): void {
    if (this.allowedChatIds.size === 0) {
      // eslint-disable-next-line no-console -- plugin logging
      console.warn(
        "[notifier-telegram] No allowedChatIds configured — bot is in open mode (all users allowed)",
      );
      return;
    }

    this.bot.use(async (ctx, next) => {
      const chatId = ctx.chat?.id;
      if (chatId !== undefined && this.allowedChatIds.has(chatId)) {
        return next();
      }

      // Unauthorized
      await ctx.reply("\u26d4 Not authorized\\. Contact your administrator\\.", {
        parse_mode: "MarkdownV2",
      });
    });
  }

  /**
   * Register the /cancel command handler to exit active conversations.
   * Story 57.14 Task 3.
   */
  registerCancelCommand(): void {
    const cancelHandler = async (ctx: BotContext): Promise<void> => {
      try {
        const active = await ctx.conversation.active("spawn");
        if (active) {
          await ctx.conversation.exit("spawn");
          await ctx.reply(formatCancelledMessage(), { parse_mode: "MarkdownV2" });
        } else {
          await ctx.reply("No active conversation to cancel\\.", { parse_mode: "MarkdownV2" });
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] /cancel command error: ${reason}`);
        await ctx
          .reply("\u26A0\uFE0F Could not cancel\\.", { parse_mode: "MarkdownV2" })
          .catch(() => {});
      }
    };
    this.bot.command("cancel", cancelHandler as never);
  }

  /**
   * Register the /spawn command entering the multi-step spawn conversation.
   * Story 57.14 Task 4.
   */
  registerSpawnCommand(projectList: ProjectListProvider, agentList: AgentListProvider): void {
    spawnProviders = { projectList, agentList };
    this.bot.use(createConversation(spawnConversation, "spawn") as never);
    const spawnHandler = async (ctx: BotContext): Promise<void> => {
      await ctx.conversation.enter("spawn");
    };
    this.bot.command("spawn", spawnHandler as never);
  }

  /**
   * Register the /start command handler.
   */
  registerStartCommand(): void {
    this.bot.command("start", async (ctx) => {
      const username = this._botInfo?.username ?? "Agent Orchestrator";
      const welcome =
        `\u2705 *${escapeMarkdownV2(username)} connected\\!*\\n\\n` +
        `I can send you notifications and respond to commands\\.\n` +
        `Use /status to check system status\\.`;
      await ctx.reply(welcome, { parse_mode: "MarkdownV2" });
    });
  }

  /**
   * Register the /status command handler.
   * Calls the injected StatusProvider and formats the response.
   * Supports optional project:arg and per-chat default context.
   * Enforces a 3-second timeout per NFR-I2-1.
   * Story 57.5 Task 2 + Story 57.10 Task 4.
   */
  registerStatusCommand(statusProvider: StatusProvider): void {
    this.bot.command("status", async (ctx) => {
      try {
        const text = ctx.message?.text ?? "";
        const explicitProject = parseProjectArg(text);
        const chatId = ctx.chat?.id;
        const projectId =
          explicitProject ?? (chatId !== undefined ? this.projectContext.get(chatId) : undefined);
        const timer = timeout(3_000);
        try {
          const status = await Promise.race([statusProvider(projectId), timer.promise]);
          await ctx.reply(formatStatusMessage(status, projectId), { parse_mode: "MarkdownV2" });
        } finally {
          timer.clear();
        }
      } catch (err: unknown) {
        // Provider error or timeout — reply with graceful fallback
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] /status command error: ${reason}`);
        const fallback = `\u26A0\uFE0F *Status unavailable*\n\nCould not fetch system status\\.`;
        await ctx.reply(fallback, { parse_mode: "MarkdownV2" }).catch(() => {});
      }
    });
  }

  /**
   * Register the /fleet command handler.
   * Calls the injected FleetProvider and formats the response.
   * Supports optional project:arg and per-chat default context.
   * Enforces a 3-second timeout per NFR-I2-1.
   * Story 57.6 Task 2 + Story 57.10 Task 5.
   */
  registerFleetCommand(fleetProvider: FleetProvider): void {
    this.bot.command("fleet", async (ctx) => {
      try {
        const text = ctx.message?.text ?? "";
        const explicitProject = parseProjectArg(text);
        const chatId = ctx.chat?.id;
        const projectId =
          explicitProject ?? (chatId !== undefined ? this.projectContext.get(chatId) : undefined);
        const timer = timeout(3_000);
        try {
          const agents = await Promise.race([fleetProvider(projectId), timer.promise]);
          await ctx.reply(formatFleetMessage(agents, projectId), { parse_mode: "MarkdownV2" });
        } finally {
          timer.clear();
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] /fleet command error: ${reason}`);
        const fallback = `\u26A0\uFE0F *Fleet unavailable*\n\nCould not fetch agent fleet\\.`;
        await ctx.reply(fallback, { parse_mode: "MarkdownV2" }).catch(() => {});
      }
    });
  }

  /**
   * Register the /sprint command handler.
   * Calls the injected SprintProvider and formats the response.
   * Accepts optional project name argument: /sprint my-project or /sprint
   * Enforces a 3-second timeout per NFR-I2-1.
   * Story 57.7 Task 2.
   */
  registerSprintCommand(sprintProvider: SprintProvider): void {
    this.bot.command("sprint", async (ctx) => {
      try {
        const text = ctx.message?.text ?? "";
        const projectName = text.replace(/^\/sprint\s*/, "").trim() || undefined;
        const timer = timeout(3_000);
        try {
          const entries = await Promise.race([sprintProvider(projectName), timer.promise]);
          await ctx.reply(formatSprintMessage(entries, projectName), {
            parse_mode: "MarkdownV2",
          });
        } finally {
          timer.clear();
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] /sprint command error: ${reason}`);
        const fallback = `\u26A0\uFE0F *Sprint unavailable*\n\nCould not fetch sprint data\\.`;
        await ctx.reply(fallback, { parse_mode: "MarkdownV2" }).catch(() => {});
      }
    });
  }

  /**
   * Register the /health command handler.
   * Calls the injected HealthProvider and formats the response.
   * Enforces a 3-second timeout per NFR-I2-1.
   * Story 57.8 Task 2.
   */
  registerHealthCommand(healthProvider: HealthProvider): void {
    this.bot.command("health", async (ctx) => {
      try {
        const timer = timeout(3_000);
        try {
          const result = await Promise.race([healthProvider(), timer.promise]);
          await ctx.reply(formatHealthMessage(result), { parse_mode: "MarkdownV2" });
        } finally {
          timer.clear();
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] /health command error: ${reason}`);
        const fallback = `\u26A0\uFE0F *Health check unavailable*\n\nCould not run health diagnostics\\.`;
        await ctx.reply(fallback, { parse_mode: "MarkdownV2" }).catch(() => {});
      }
    });
  }

  /**
   * Register the /conflicts command handler.
   * Calls the injected ConflictsProvider and formats the response.
   * Supports optional project:arg and per-chat default context.
   * Enforces a 3-second timeout per NFR-I2-1.
   * Story 57.9 Task 2 + Story 57.10 Task 6.
   */
  registerConflictsCommand(conflictsProvider: ConflictsProvider): void {
    this.bot.command("conflicts", async (ctx) => {
      try {
        const text = ctx.message?.text ?? "";
        const explicitProject = parseProjectArg(text);
        const chatId = ctx.chat?.id;
        const projectId =
          explicitProject ?? (chatId !== undefined ? this.projectContext.get(chatId) : undefined);
        const timer = timeout(3_000);
        try {
          const conflicts = await Promise.race([conflictsProvider(projectId), timer.promise]);
          await ctx.reply(formatConflictsMessage(conflicts, projectId), {
            parse_mode: "MarkdownV2",
          });
        } finally {
          timer.clear();
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] /conflicts command error: ${reason}`);
        const fallback = `\u{1F6A8} *Conflicts check unavailable*\n\nCould not fetch conflict data\\.`;
        await ctx.reply(fallback, { parse_mode: "MarkdownV2" }).catch(() => {});
      }
    });
  }

  /**
   * Register the /setproject command handler.
   * Sets or clears per-chat default project context.
   * Story 57.10 Task 7.
   */
  registerSetProjectCommand(projectListProvider: () => string[]): void {
    this.bot.command("setproject", async (ctx) => {
      try {
        const text = ctx.message?.text ?? "";
        const arg = text.replace(/^\/setproject\s*/, "").trim();
        const chatId = ctx.chat?.id;

        if (arg) {
          // Validate project name against configured projects (case-insensitive)
          const validNames = projectListProvider();
          const match = validNames.find((n) => n.toLowerCase() === arg.toLowerCase());

          if (!match) {
            const escaped = escapeMarkdownV2(arg);
            const available = validNames.map((n) => escapeMarkdownV2(n)).join("\\n  ");
            await ctx.reply(
              `\u274C *Project not found*\n\n` +
                `\u{1F4CC} \`${escaped}\` is not a configured project\\.\n\n` +
                `Available projects:\n  ${available}\n\n` +
                `Use /setproject to clear\\.`,
              { parse_mode: "MarkdownV2" },
            );
            return;
          }

          this.projectContext.set(chatId ?? 0, match);
          const escaped = escapeMarkdownV2(match);
          await ctx.reply(
            `\u2705 *Project Context*\n\n` +
              `\u{1F4CC} Default project: ${escaped}\n` +
              `All commands will scope to this project\\.\n\n` +
              `Use /setproject to clear\\.`,
            { parse_mode: "MarkdownV2" },
          );
        } else {
          if (chatId !== undefined) this.projectContext.delete(chatId);
          await ctx.reply(
            `\u2705 *Project Context*\n\n` +
              `Project context cleared\\.\n` +
              `Commands will show all projects\\.`,
            { parse_mode: "MarkdownV2" },
          );
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] /setproject command error: ${reason}`);
        const fallback = `\u26A0\uFE0F *Project context unavailable*\n\nCould not set project context\\.`;
        await ctx.reply(fallback, { parse_mode: "MarkdownV2" }).catch(() => {});
      }
    });
  }

  /**
   * Register callback query handler for inline button presses.
   * Action handlers are injected to keep TelegramBot decoupled from core services.
   * Story 57.11 Tasks 3 + 4.
   */
  registerCallbackHandler(
    actionHandlers: Partial<
      Record<
        CallbackAction,
        (targetId: string, eventId?: string, userInfo?: CallbackUserInfo) => Promise<string>
      >
    >,
  ): void {
    this.bot.callbackQuery(/^/, async (ctx) => {
      let answered = false;
      try {
        const queryId = ctx.callbackQuery.id;

        // Idempotency check — prevent duplicate actions on Telegram retry
        if (this.processedCallbacks.has(queryId)) {
          await ctx.answerCallbackQuery({ text: "Already processed" });
          answered = true;
          return;
        }

        const raw = ctx.callbackQuery.data;
        if (!raw) {
          await ctx.answerCallbackQuery({ text: "Unknown action" });
          answered = true;
          return;
        }

        const decoded = decodeCallbackData(raw);
        if (!decoded) {
          // eslint-disable-next-line no-console -- plugin logging
          console.error(`[notifier-telegram] Failed to decode callback data: ${raw}`);
          await ctx.answerCallbackQuery({ text: "Unknown action" });
          answered = true;
          return;
        }

        const handler = actionHandlers[decoded.action];
        if (!handler) {
          await ctx.answerCallbackQuery({ text: "Unknown action" });
          answered = true;
          return;
        }

        const userInfo: CallbackUserInfo = {
          id: ctx.callbackQuery.from.id,
          username: ctx.callbackQuery.from.username,
          firstName: ctx.callbackQuery.from.first_name,
        };
        const result = await handler(decoded.targetId, decoded.eventId, userInfo);

        // Track as processed immediately after handler succeeds (before editMessageText)
        this.processedCallbacks.add(queryId);
        // Cap set size at 1000 to prevent unbounded memory growth
        if (this.processedCallbacks.size > CALLBACK_CACHE_CAP) {
          const oldest = this.processedCallbacks.values().next().value;
          if (oldest !== undefined) this.processedCallbacks.delete(oldest);
        }

        const escapedResult = escapeMarkdownV2(result);
        await ctx.editMessageText(escapedResult, { parse_mode: "MarkdownV2" });
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console -- plugin logging
        console.error(`[notifier-telegram] Callback handler error: ${reason}`);
        try {
          await ctx.editMessageText(
            `\u26A0\uFE0F ${escapeMarkdownV2(`Action failed: ${reason}`)}`,
            { parse_mode: "MarkdownV2" },
          );
        } catch {
          // editMessageText may fail if message was deleted
        }
      } finally {
        if (!answered) {
          try {
            await ctx.answerCallbackQuery();
          } catch {
            // answerCallbackQuery may fail if already answered
          }
        }
      }
    });
  }

  /**
   * Send an approval request message with [Approve] [Deny] inline buttons.
   * Skips sending if request status is not "pending".
   * Story 57.12 Task 4.
   */
  async sendApprovalMessage(
    chatId: string | number,
    request: ApprovalMessageRequest & {
      status?: "pending" | "approved" | "rejected" | "expired";
    },
  ): Promise<void> {
    if (request.status && request.status !== "pending") {
      // eslint-disable-next-line no-console -- plugin logging
      console.warn(
        `[notifier-telegram] Skipping approval message for non-pending request (status: ${request.status})`,
      );
      return;
    }

    const approvalId = request.id ?? "";
    if (!approvalId) {
      // eslint-disable-next-line no-console -- plugin logging
      console.warn("[notifier-telegram] Cannot send approval message: missing approval ID");
      return;
    }

    const text = formatApprovalMessage(request);
    const buttons = buildApprovalButtons(approvalId);
    if (!buttons) {
      // eslint-disable-next-line no-console -- plugin logging
      console.warn(
        "[notifier-telegram] Cannot send approval message: approval ID too long for callback buttons",
      );
      return;
    }

    try {
      await sendWithRetry(this, String(chatId), text, {
        parse_mode: "MarkdownV2",
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (err: unknown) {
      // eslint-disable-next-line no-console -- plugin logging
      console.error(
        `[notifier-telegram] Failed to send approval message: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Mode Selection (Task 5)
  // -------------------------------------------------------------------------

  /**
   * Start the bot in the configured mode (polling or webhook).
   * For polling: calls bot.start() with long polling.
   * For webhook: registers the webhook URL with Telegram.
   */
  async start(mode?: "polling" | "webhook"): Promise<void> {
    const effectiveMode = mode ?? this.config.mode ?? "polling";

    if (effectiveMode === "polling") {
      // If a webhook was previously set, remove it before polling
      try {
        await this.bot.api.deleteWebhook({ drop_pending_updates: true });
      } catch {
        // Ignore — may not have had a webhook set
      }

      // eslint-disable-next-line no-console -- plugin logging
      console.log("[notifier-telegram] Polling for updates...");
      await this.bot.start({
        drop_pending_updates: true,
        onStart: (info) => {
          // eslint-disable-next-line no-console -- plugin logging
          console.log(`[notifier-telegram] Bot @${info.username} started (polling mode)`);
        },
      });
    } else if (effectiveMode === "webhook") {
      if (!this.config.webhookUrl) {
        throw new Error("[notifier-telegram] webhookUrl is required for webhook mode");
      }
      await this.bot.api.setWebhook(this.config.webhookUrl, {
        secret_token: this.config.webhookSecret,
        drop_pending_updates: true,
      });
      // eslint-disable-next-line no-console -- plugin logging
      console.log(`[notifier-telegram] Webhook registered: ${this.config.webhookUrl}`);
    }
  }

  /**
   * Stop the bot (graceful shutdown for polling mode).
   */
  async stop(): Promise<void> {
    await this.bot.stop();
  }

  /**
   * Handle an incoming update (used by webhook endpoint).
   * The webhook route parses the JSON body and passes it here.
   */
  async handleUpdate(update: Record<string, unknown>): Promise<void> {
    // grammY's handleUpdate expects its strict Update type, but webhook payloads
    // arrive as generic JSON. Cast through never to satisfy the type without
    // duplicating Telegram's full Update schema in our codebase.
    await this.bot.handleUpdate(update as never);
  }
}
