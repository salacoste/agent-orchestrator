/**
 * History query — filter and search sprint history entries.
 *
 * Provides filtering by story, epic, date range, and target status
 * on top of the raw JSONL history data.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory, type HistoryEntry } from "./history.js";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HistoryFilter {
  storyId?: string;
  epic?: string;
  fromDate?: string; // YYYY-MM-DD inclusive
  toDate?: string; // YYYY-MM-DD inclusive
  toStatus?: string;
  search?: string;
  limit?: number;
}

export interface HistoryQueryResult {
  entries: HistoryEntry[];
  total: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function queryHistory(project: ProjectConfig, filters: HistoryFilter): HistoryQueryResult {
  let entries = readHistory(project);

  // Filter by storyId
  if (filters.storyId) {
    entries = entries.filter((e) => e.storyId === filters.storyId);
  }

  // Filter by epic (resolve to story IDs)
  if (filters.epic) {
    try {
      const sprint = readSprintStatus(project);
      const epicStoryIds = getEpicStoryIds(sprint, filters.epic);
      entries = entries.filter((e) => epicStoryIds.has(e.storyId));
    } catch {
      // Sprint status unavailable — return empty
      entries = [];
    }
  }

  // Filter by date range
  if (filters.fromDate) {
    const from = filters.fromDate;
    entries = entries.filter((e) => e.timestamp.slice(0, 10) >= from);
  }
  if (filters.toDate) {
    const to = filters.toDate;
    entries = entries.filter((e) => e.timestamp.slice(0, 10) <= to);
  }

  // Filter by target status
  if (filters.toStatus) {
    const status = filters.toStatus;
    entries = entries.filter((e) => e.toStatus === status);
  }

  // Filter by text search — case-insensitive substring match
  if (filters.search) {
    const term = filters.search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.storyId.toLowerCase().includes(term) ||
        e.fromStatus.toLowerCase().includes(term) ||
        e.toStatus.toLowerCase().includes(term) ||
        (e.comment !== undefined && e.comment.toLowerCase().includes(term)),
    );
  }

  const total = entries.length;

  // Apply limit (default: all)
  if (filters.limit && filters.limit > 0) {
    entries = entries.slice(-filters.limit);
  }

  return { entries, total };
}
