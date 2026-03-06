import chalk from "chalk";
import type { CIStatus, ReviewDecision, ActivityState, AgentStatus } from "@composio/ao-core";

export function header(title: string): string {
  const line = "─".repeat(76);
  return [
    chalk.dim(`┌${line}┐`),
    chalk.dim("│") + chalk.bold(` ${title}`.padEnd(76)) + chalk.dim("│"),
    chalk.dim(`└${line}┘`),
  ].join("\n");
}

export function banner(title: string): string {
  const line = "═".repeat(76);
  return [
    chalk.dim(`╔${line}╗`),
    chalk.dim("║") + chalk.bold.cyan(` ${title}`.padEnd(76)) + chalk.dim("║"),
    chalk.dim(`╚${line}╝`),
  ].join("\n");
}

export function formatAge(epochMs: number): string {
  const diff = Math.floor((Date.now() - epochMs) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Format time since a given date.
 * Returns human-readable string like "2m ago", "1h ago", "3d ago".
 */
export function formatTimeAgo(timestamp: Date | string | null): string {
  if (!timestamp) return "—";

  const time = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - time.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Format duration since start time.
 * Returns "5m", "1h 23m", etc.
 */
export function formatDuration(startTime: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - startTime.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffHours > 0) {
    const mins = diffMins % 60;
    return `${diffHours}h ${mins}m`;
  }
  return `${diffMins}m`;
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Get emoji for agent status.
 */
export function getAgentStatusEmoji(status: AgentStatus | string): string {
  const emojiMap: Record<string, string> = {
    spawning: "🔄",
    active: "🟢",
    idle: "🟡",
    completed: "✅",
    blocked: "🔴",
    disconnected: "⚫",
  };
  return emojiMap[status] || "❓";
}

/**
 * Get emoji for story status.
 */
export function getStoryStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    backlog: "📋",
    "ready-for-dev": "🟡",
    "in-progress": "🔵",
    review: "👁️",
    done: "✅",
    optional: "⚪",
  };
  return emojiMap[status] || "❓";
}

/**
 * Get color for agent status.
 */
export function getAgentStatusColor(status: AgentStatus | string): string {
  switch (status) {
    case "spawning":
      return chalk.cyan(status);
    case "active":
      return chalk.green(status);
    case "idle":
      return chalk.yellow(status);
    case "completed":
      return chalk.green(status);
    case "blocked":
      return chalk.red(status);
    case "disconnected":
      return chalk.gray(status);
    default:
      return status;
  }
}

/**
 * Get color for story status.
 */
export function getStoryStatusColor(status: string): string {
  switch (status) {
    case "backlog":
      return chalk.gray(status);
    case "ready-for-dev":
      return chalk.yellow(status);
    case "in-progress":
      return chalk.blue(status);
    case "review":
      return chalk.magenta(status);
    case "done":
      return chalk.green(status);
    case "optional":
      return chalk.dim(status);
    default:
      return status;
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "working":
      return chalk.green(status);
    case "idle":
      return chalk.yellow(status);
    case "pr_open":
    case "review_pending":
      return chalk.blue(status);
    case "approved":
    case "mergeable":
    case "merged":
      return chalk.green(status);
    case "ci_failed":
    case "errored":
    case "stuck":
      return chalk.red(status);
    case "changes_requested":
    case "needs_input":
      return chalk.magenta(status);
    case "spawning":
      return chalk.cyan(status);
    case "killed":
    case "cleanup":
      return chalk.gray(status);
    default:
      return status;
  }
}

export function ciStatusIcon(status: CIStatus | null): string {
  switch (status) {
    case "passing":
      return chalk.green("pass");
    case "failing":
      return chalk.red("fail");
    case "pending":
      return chalk.yellow("pend");
    case "none":
    case null:
      return chalk.dim("-");
  }
}

export function reviewDecisionIcon(decision: ReviewDecision | null): string {
  switch (decision) {
    case "approved":
      return chalk.green("ok");
    case "changes_requested":
      return chalk.red("chg!");
    case "pending":
      return chalk.yellow("rev?");
    case "none":
    case null:
      return chalk.dim("-");
  }
}

export function activityIcon(activity: ActivityState | null): string {
  switch (activity) {
    case "active":
      return chalk.green("working");
    case "ready":
      return chalk.cyan("ready");
    case "idle":
      return chalk.yellow("idle");
    case "waiting_input":
      return chalk.magenta("waiting");
    case "blocked":
      return chalk.red("blocked");
    case "exited":
      return chalk.dim("exited");
    case null:
      return chalk.dim("unknown");
  }
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;]*m/g;

/** Pad/truncate a string to exactly `width` visible characters */
export function padCol(str: string, width: number): string {
  // Strip ANSI codes to measure visible length
  const visible = str.replace(ANSI_RE, "");
  if (visible.length > width) {
    // Truncate visible content, re-apply truncation
    const plain = visible.slice(0, width - 1) + "\u2026";
    return plain.padEnd(width);
  }
  // Pad with spaces based on visible length
  const padding = width - visible.length;
  return str + " ".repeat(Math.max(0, padding));
}
