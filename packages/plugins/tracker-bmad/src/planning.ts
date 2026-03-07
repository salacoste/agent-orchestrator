/**
 * Sprint planning — recommends stories based on velocity, dependencies,
 * and capacity.
 */

import type { ProjectConfig } from "@composio/ao-core";
import {
  readSprintStatus,
  hasPointsData,
  getPoints,
  getEpicStoryIds,
} from "./sprint-status-reader.js";
import { validateDependencies, computeDependencyGraph } from "./dependencies.js";
import { computeVelocityComparison } from "./velocity-comparison.js";
import { batchWriteStoryStatus } from "./auto-transition.js";
import { appendHistory } from "./history.js";

// ---------------------------------------------------------------------------
// Accept plan result type
// ---------------------------------------------------------------------------

export interface AcceptPlanResult {
  moved: string[];
  count: number;
}
// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlannableStory {
  id: string;
  title: string;
  epic: string | null;
  isBlocked: boolean;
  blockers: string[];
  points?: number;
  priority?: "critical" | "high" | "medium" | "low";
  score?: number;
  unblockCount?: number;
}

export interface SprintPlanningResult {
  backlogStories: PlannableStory[];
  recommended: PlannableStory[];
  sprintConfig: {
    startDate: string | null;
    endDate: string | null;
    goal: string | null;
    targetVelocity: number | null;
  };
  capacity: {
    historicalVelocity: number;
    historicalVelocityPoints?: number;
    targetVelocity: number | null;
    effectiveTarget: number;
    inProgressCount: number;
    inProgressPoints?: number;
    remainingCapacity: number;
    remainingCapacityPoints?: number;
  };
  loadStatus: "under" | "at-capacity" | "over" | "no-data";
  hasPoints: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readConfigString(project: ProjectConfig, key: string): string | null {
  const v = project.tracker?.[key];
  return typeof v === "string" ? v : null;
}

function readConfigNumber(project: ProjectConfig, key: string): number | null {
  const v = project.tracker?.[key];
  return typeof v === "number" ? v : null;
}

const PRIORITY_WEIGHTS: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function computePlanningScore(story: PlannableStory): number {
  const priorityScore = PRIORITY_WEIGHTS[story.priority ?? "low"] ?? 1;
  const unblockScore = (story.unblockCount ?? 0) * 2;
  const sizeScore = story.points ? Math.max(0, 5 - story.points) : 2; // smaller first
  return priorityScore * 3 + unblockScore + sizeScore;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeSprintPlan(
  project: ProjectConfig,
  epicFilter?: string,
): SprintPlanningResult {
  // Read sprint status
  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return emptyResult(project);
  }

  const entries = sprint.development_status;
  const pointsPresent = hasPointsData(sprint);
  const epicStoryIds = epicFilter ? getEpicStoryIds(sprint, epicFilter) : null;

  // Build dependency graph to count how many stories each story unblocks
  const depGraph = computeDependencyGraph(project);
  const unblockCounts: Record<string, number> = {};
  for (const node of Object.values(depGraph.nodes)) {
    unblockCounts[node.storyId] = node.blocks.length;
  }

  // Collect backlog + ready-for-dev stories
  const backlogStories: PlannableStory[] = [];
  let inProgressCount = 0;
  let inProgressPoints = 0;

  for (const [id, entry] of Object.entries(entries)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";

    // Skip epic-level entries
    if (id.startsWith("epic-") || status.startsWith("epic-")) continue;
    // Skip stories not in the filtered epic
    if (epicStoryIds && !epicStoryIds.has(id)) continue;

    if (status === "in-progress" || status === "review") {
      inProgressCount++;
      if (pointsPresent) inProgressPoints += getPoints(entry);
      continue;
    }

    if (status === "done") continue;

    // backlog or ready-for-dev — plannable
    const depResult = validateDependencies(id, project);
    const epic = typeof entry.epic === "string" ? entry.epic : null;

    // Read priority from sprint-status entry
    const rawPriority = entry["priority"];
    const priority =
      typeof rawPriority === "string" && ["critical", "high", "medium", "low"].includes(rawPriority)
        ? (rawPriority as PlannableStory["priority"])
        : undefined;

    const story: PlannableStory = {
      id,
      title: id, // We use ID as title since story files aren't always available
      epic,
      isBlocked: depResult.blocked,
      blockers: depResult.blockers.map((b) => b.id),
      priority,
      unblockCount: unblockCounts[id] ?? 0,
    };
    if (pointsPresent) story.points = getPoints(entry);
    story.score = computePlanningScore(story);

    backlogStories.push(story);
  }

  // Sort: unblocked first, then by score descending
  backlogStories.sort((a, b) => {
    if (a.isBlocked !== b.isBlocked) return a.isBlocked ? 1 : -1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  // Config
  const startDate = readConfigString(project, "sprintStartDate");
  const endDate = readConfigString(project, "sprintEndDate");
  const goal = readConfigString(project, "sprintGoal");
  const targetVelocity = readConfigNumber(project, "targetVelocity");

  // Historical velocity
  let historicalVelocity = 0;
  let historicalVelocityPoints: number | undefined;
  try {
    const velResult = computeVelocityComparison(project);
    historicalVelocity = velResult.averageVelocity;
    if (pointsPresent && velResult.averageVelocityPoints !== undefined) {
      historicalVelocityPoints = velResult.averageVelocityPoints;
    }
  } catch {
    // Non-fatal
  }

  const effectiveTarget = targetVelocity ?? historicalVelocity;
  const remainingCapacity = Math.max(0, effectiveTarget - inProgressCount);

  // Recommended: first N unblocked stories that fit remaining capacity
  const recommended = backlogStories
    .filter((s) => !s.isBlocked)
    .slice(0, Math.max(0, Math.ceil(remainingCapacity)));

  // Load status
  let loadStatus: SprintPlanningResult["loadStatus"] = "no-data";
  if (effectiveTarget > 0) {
    if (inProgressCount > effectiveTarget) {
      loadStatus = "over";
    } else if (inProgressCount >= effectiveTarget) {
      loadStatus = "at-capacity";
    } else {
      loadStatus = "under";
    }
  }

  const capacity: SprintPlanningResult["capacity"] = {
    historicalVelocity,
    targetVelocity,
    effectiveTarget,
    inProgressCount,
    remainingCapacity,
  };

  if (pointsPresent) {
    capacity.historicalVelocityPoints = historicalVelocityPoints;
    capacity.inProgressPoints = inProgressPoints;
    capacity.remainingCapacityPoints = Math.max(0, effectiveTarget - inProgressPoints);
  }

  return {
    backlogStories,
    recommended,
    sprintConfig: {
      startDate,
      endDate,
      goal,
      targetVelocity,
    },
    capacity,
    loadStatus,
    hasPoints: pointsPresent,
  };
}

function emptyResult(project: ProjectConfig): SprintPlanningResult {
  return {
    backlogStories: [],
    recommended: [],
    sprintConfig: {
      startDate: readConfigString(project, "sprintStartDate"),
      endDate: readConfigString(project, "sprintEndDate"),
      goal: readConfigString(project, "sprintGoal"),
      targetVelocity: readConfigNumber(project, "targetVelocity"),
    },
    capacity: {
      historicalVelocity: 0,
      targetVelocity: readConfigNumber(project, "targetVelocity"),
      effectiveTarget: readConfigNumber(project, "targetVelocity") ?? 0,
      inProgressCount: 0,
      remainingCapacity: readConfigNumber(project, "targetVelocity") ?? 0,
    },
    loadStatus: "no-data",
    hasPoints: false,
  };
}

// ---------------------------------------------------------------------------
// Accept plan — move recommended stories to ready-for-dev
// ---------------------------------------------------------------------------

export function acceptPlan(project: ProjectConfig, epicFilter?: string): AcceptPlanResult {
  const plan = computeSprintPlan(project, epicFilter);

  if (plan.recommended.length === 0) {
    return { moved: [], count: 0 };
  }

  const updates = plan.recommended.map((s) => ({
    storyId: s.id,
    newStatus: "ready-for-dev",
  }));

  const moved = batchWriteStoryStatus(project, updates);

  for (const id of moved) {
    appendHistory(project, id, "backlog", "ready-for-dev");
  }

  return { moved, count: moved.length };
}
