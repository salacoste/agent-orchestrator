/**
 * Pure formatting utilities safe for both server and client components.
 * No side effects, no external dependencies.
 */

import type { ActivityState } from "@composio/ao-core";
import type { DashboardSession } from "./types";

/**
 * Format duration from an ISO date string to now.
 * Returns "Xh Ym" or "Xm" for shorter durations.
 */
export function formatDuration(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 0) return "0m";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${totalMinutes}m`;
}

/**
 * Format relative time from an ISO date string.
 * Returns "Xs ago", "Xm ago", "Xh ago", "Xd ago".
 */
export function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Status display info: emoji, label, tailwind color class */
export interface StatusInfo {
  emoji: string;
  label: string;
  color: string;
}

/** Map activity state to display status */
export function getStatusInfo(activity: ActivityState | null): StatusInfo {
  switch (activity) {
    case "blocked":
      return { emoji: "🔴", label: "blocked", color: "text-red-500" };
    case "idle":
      return { emoji: "🟡", label: "idle", color: "text-yellow-500" };
    case "exited":
      return { emoji: "⚫", label: "exited", color: "text-gray-500" };
    case "waiting_input":
      return { emoji: "🟠", label: "waiting", color: "text-orange-500" };
    case "active":
    case "ready":
    default:
      return { emoji: "🟢", label: "active", color: "text-green-500" };
  }
}

/**
 * Humanize a git branch name into a readable title.
 * e.g., "feat/infer-project-id" → "Infer Project ID"
 *       "fix/broken-auth-flow"  → "Broken Auth Flow"
 *       "session/ao-52"         → "ao-52"
 */
export function humanizeBranch(branch: string): string {
  // Remove common prefixes
  const withoutPrefix = branch.replace(
    /^(?:feat|fix|chore|refactor|docs|test|ci|session|release|hotfix|feature|bugfix|build|wip|improvement)\//,
    "",
  );
  // Replace hyphens and underscores with spaces, then title-case each word
  return withoutPrefix
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Compute the best display title for a session card.
 *
 * Fallback chain (ordered by signal quality):
 *   1. PR title         — human-visible deliverable name
 *   2. Quality summary   — real agent-generated summary (not a fallback)
 *   3. Issue title       — human-written task description
 *   4. Any summary       — even a fallback excerpt is better than nothing
 *   5. Humanized branch  — last resort with semantic content
 *   6. Status text       — absolute fallback
 */
export function getSessionTitle(session: DashboardSession): string {
  // 1. PR title — always best
  if (session.pr?.title) return session.pr.title;

  // 2. Quality summary — skip fallback summaries (truncated spawn prompts)
  if (session.summary && !session.summaryIsFallback) {
    return session.summary;
  }

  // 3. Issue title — human-written task description
  if (session.issueTitle) return session.issueTitle;

  // 4. Any summary — even fallback excerpts beat branch names
  if (session.summary) return session.summary;

  // 5. Humanized branch
  if (session.branch) return humanizeBranch(session.branch);

  // 6. Status
  return session.status;
}
