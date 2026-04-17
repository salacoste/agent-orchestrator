/**
 * Shared scenario UI helpers — status badges and date formatting (Story 54.2).
 *
 * Used by ScenarioCard, ScenarioDetail, and related components.
 */

import type { ScenarioStatus } from "./types";

/** CSS classes for scenario status badges. */
export function statusBadgeColor(status: ScenarioStatus): string {
  switch (status) {
    case "draft":
      return "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]";
    case "simulated":
      return "bg-[var(--color-accent)]/15 text-[var(--color-accent)]";
    case "applied":
      return "bg-[var(--color-success)]/15 text-[var(--color-success)]";
  }
}

/** Human-readable label for scenario status. */
export function statusLabel(status: ScenarioStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "simulated":
      return "Simulated";
    case "applied":
      return "Applied";
  }
}

/** Format an ISO date string for display. */
export function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/** Human-readable label for simulation confidence level. */
export function confidenceLabel(c: number): string {
  if (c >= 0.8) return "High";
  if (c >= 0.5) return "Medium";
  return "Low";
}

/** Relative time description (e.g., "2 hours ago", "3 days ago"). */
export function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate);
  const diffMs = now - then.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}
