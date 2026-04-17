/**
 * Shared status → fill color mapping for dependency graph views.
 * Single source of truth for STATUS_FILL used by DependencyGraphView and CrossProjectGraphView.
 */

export const STATUS_FILL: Record<string, string> = {
  backlog: "#3f3f46",
  "ready-for-dev": "#a16207",
  "in-progress": "#1d4ed8",
  review: "#7e22ce",
  done: "#15803d",
  blocked: "#dc2626",
  unknown: "#52525b",
};
