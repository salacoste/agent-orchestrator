/**
 * Rework / churn detection — identifies stories that bounced backward
 * in the workflow (e.g. review -> in-progress) and measures the cost.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readHistory } from "./history.js";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";
import { isBackwardTransition } from "./workflow-columns.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReworkEvent {
  storyId: string;
  fromStatus: string;
  toStatus: string;
  timestamp: string;
  reworkCycleMs: number | null; // time until next forward progress
}

export interface StoryRework {
  storyId: string;
  reworkCount: number;
  totalReworkTimeMs: number;
  events: ReworkEvent[];
}

export interface TransitionReworkStat {
  from: string;
  to: string;
  count: number;
  averageReworkTimeMs: number;
}

export interface ReworkResult {
  stories: StoryRework[];
  reworkRate: number; // % of stories that bounced
  totalReworkEvents: number;
  totalReworkTimeMs: number;
  transitionStats: TransitionReworkStat[]; // sorted by count desc
  worstOffenders: Array<{
    storyId: string;
    reworkCount: number;
    totalReworkTimeMs: number;
  }>;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeRework(project: ProjectConfig, epicFilter?: string): ReworkResult {
  const history = readHistory(project);

  // Determine the set of story IDs to include (epic filter)
  let epicStoryIds: Set<string> | null = null;
  if (epicFilter) {
    try {
      const sprint = readSprintStatus(project);
      epicStoryIds = getEpicStoryIds(sprint, epicFilter);
    } catch {
      // No sprint-status.yaml — cannot filter by epic, return empty
      return emptyResult();
    }
  }

  // Group history entries by storyId, preserving chronological order
  const byStory = new Map<
    string,
    Array<{ timestamp: string; fromStatus: string; toStatus: string }>
  >();
  for (const entry of history) {
    // Skip comment entries (fromStatus === toStatus)
    if (entry.fromStatus === entry.toStatus) continue;
    if (epicStoryIds && !epicStoryIds.has(entry.storyId)) continue;

    const list = byStory.get(entry.storyId) ?? [];
    list.push({
      timestamp: entry.timestamp,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
    });
    byStory.set(entry.storyId, list);
  }

  const stories: StoryRework[] = [];
  let totalReworkEvents = 0;
  let totalReworkTimeMs = 0;
  const allStoryIds = new Set<string>();

  // Track transition stats: key = "from->to"
  const transitionMap = new Map<string, { count: number; totalMs: number }>();

  for (const [storyId, transitions] of byStory) {
    allStoryIds.add(storyId);

    const reworkEvents: ReworkEvent[] = [];

    for (let i = 0; i < transitions.length; i++) {
      const t = transitions[i];
      if (!t || !isBackwardTransition(project, t.fromStatus, t.toStatus)) continue;

      // Look ahead for the next forward transition to compute reworkCycleMs
      let reworkCycleMs: number | null = null;
      for (let j = i + 1; j < transitions.length; j++) {
        const next = transitions[j];
        if (!next) continue;
        if (!isBackwardTransition(project, next.fromStatus, next.toStatus)) {
          // This is a forward (or lateral) transition — end of rework cycle
          reworkCycleMs = new Date(next.timestamp).getTime() - new Date(t.timestamp).getTime();
          break;
        }
      }

      reworkEvents.push({
        storyId,
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        timestamp: t.timestamp,
        reworkCycleMs,
      });

      // Aggregate transition stats
      const key = `${t.fromStatus}->${t.toStatus}`;
      const stat = transitionMap.get(key) ?? { count: 0, totalMs: 0 };
      stat.count++;
      if (reworkCycleMs !== null) {
        stat.totalMs += reworkCycleMs;
      }
      transitionMap.set(key, stat);
    }

    if (reworkEvents.length > 0) {
      const storyReworkTimeMs = reworkEvents.reduce((sum, e) => sum + (e.reworkCycleMs ?? 0), 0);
      stories.push({
        storyId,
        reworkCount: reworkEvents.length,
        totalReworkTimeMs: storyReworkTimeMs,
        events: reworkEvents,
      });
      totalReworkEvents += reworkEvents.length;
      totalReworkTimeMs += storyReworkTimeMs;
    }
  }

  // Rework rate: % of stories that had at least one backward transition
  const totalStories = allStoryIds.size;
  const reworkRate = totalStories > 0 ? (stories.length / totalStories) * 100 : 0;

  // Transition stats sorted by count desc
  const transitionStats: TransitionReworkStat[] = [];
  for (const [key, stat] of transitionMap) {
    const parts = key.split("->");
    transitionStats.push({
      from: parts[0] ?? "",
      to: parts[1] ?? "",
      count: stat.count,
      averageReworkTimeMs: stat.count > 0 ? stat.totalMs / stat.count : 0,
    });
  }
  transitionStats.sort((a, b) => b.count - a.count);

  // Worst offenders: top 10 by reworkCount
  const worstOffenders = stories
    .slice()
    .sort((a, b) => b.reworkCount - a.reworkCount || b.totalReworkTimeMs - a.totalReworkTimeMs)
    .slice(0, 10)
    .map((s) => ({
      storyId: s.storyId,
      reworkCount: s.reworkCount,
      totalReworkTimeMs: s.totalReworkTimeMs,
    }));

  return {
    stories,
    reworkRate,
    totalReworkEvents,
    totalReworkTimeMs,
    transitionStats,
    worstOffenders,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(): ReworkResult {
  return {
    stories: [],
    reworkRate: 0,
    totalReworkEvents: 0,
    totalReworkTimeMs: 0,
    transitionStats: [],
    worstOffenders: [],
  };
}
