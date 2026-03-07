/**
 * Story aging detection — identifies stories that have been in a column
 * longer than the P90 threshold, with per-column percentile analysis.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory } from "./history.js";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AgingStory {
  storyId: string;
  column: string;
  ageMs: number;
  lastTransition: string; // ISO timestamp
  isAging: boolean; // true if > P90 for its column
}

export interface ColumnAgingStats {
  column: string;
  stories: AgingStory[];
  p50Ms: number;
  p75Ms: number;
  p90Ms: number;
  p95Ms: number;
}

export interface StoryAgingResult {
  columns: Record<string, ColumnAgingStats>;
  agingStories: AgingStory[]; // only stories flagged as aging
  totalActive: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  const weight = idx - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeStoryAging(project: ProjectConfig, epicFilter?: string): StoryAgingResult {
  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return { columns: {}, agingStories: [], totalActive: 0 };
  }

  const epicStoryIds = epicFilter ? getEpicStoryIds(sprint, epicFilter) : null;
  const history = readHistory(project);
  const now = Date.now();

  // Find last transition per story from history
  const lastTransitionMap = new Map<string, string>();
  for (const entry of history) {
    // Always take the latest — history is chronologically ordered
    lastTransitionMap.set(entry.storyId, entry.timestamp);
  }

  // Collect non-done stories
  const storyAges: AgingStory[] = [];

  for (const [id, entry] of Object.entries(sprint.development_status)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (id.startsWith("epic-") || status.startsWith("epic-")) continue;
    if (status === "done") continue;
    if (epicStoryIds && !epicStoryIds.has(id)) continue;

    const lastTs = lastTransitionMap.get(id);
    // Stories with no history get a very old timestamp (30 days ago)
    const transitionTime = lastTs ? new Date(lastTs).getTime() : now - 30 * 24 * 60 * 60 * 1000;
    const ageMs = now - transitionTime;

    storyAges.push({
      storyId: id,
      column: status,
      ageMs,
      lastTransition: lastTs ?? new Date(transitionTime).toISOString(),
      isAging: false, // will be set after percentile calculation
    });
  }

  // Group by column and compute percentiles
  const byColumn = new Map<string, AgingStory[]>();
  for (const story of storyAges) {
    const list = byColumn.get(story.column) ?? [];
    list.push(story);
    byColumn.set(story.column, list);
  }

  const columns: Record<string, ColumnAgingStats> = {};
  const agingStories: AgingStory[] = [];

  for (const [column, stories] of byColumn) {
    const ages = stories.map((s) => s.ageMs).sort((a, b) => a - b);

    const p50Ms = percentile(ages, 50);
    const p75Ms = percentile(ages, 75);
    const p90Ms = percentile(ages, 90);
    const p95Ms = percentile(ages, 95);

    // Flag stories above P90
    for (const story of stories) {
      if (story.ageMs > p90Ms) {
        story.isAging = true;
        agingStories.push(story);
      }
    }

    columns[column] = { column, stories, p50Ms, p75Ms, p90Ms, p95Ms };
  }

  return { columns, agingStories, totalActive: storyAges.length };
}
