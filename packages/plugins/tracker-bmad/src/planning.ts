/**
 * Sprint planning — recommends stories based on velocity, dependencies,
 * and capacity.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus } from "./sprint-status-reader.js";
import { validateDependencies } from "./dependencies.js";
import { computeVelocityComparison } from "./velocity-comparison.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlannableStory {
  id: string;
  title: string;
  epic: string | null;
  isBlocked: boolean;
  blockers: string[];
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
    targetVelocity: number | null;
    effectiveTarget: number;
    inProgressCount: number;
    remainingCapacity: number;
  };
  loadStatus: "under" | "at-capacity" | "over" | "no-data";
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeSprintPlan(project: ProjectConfig): SprintPlanningResult {
  // Read sprint status
  let entries: Record<string, { status: string; epic?: string; [key: string]: unknown }>;
  try {
    const sprint = readSprintStatus(project);
    entries = sprint.development_status;
  } catch {
    return emptyResult(project);
  }

  // Collect backlog + ready-for-dev stories
  const backlogStories: PlannableStory[] = [];
  let inProgressCount = 0;

  for (const [id, entry] of Object.entries(entries)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";

    // Skip epic-level entries
    if (id.startsWith("epic-") || status.startsWith("epic-")) continue;

    if (status === "in-progress" || status === "review") {
      inProgressCount++;
      continue;
    }

    if (status === "done") continue;

    // backlog or ready-for-dev — plannable
    const depResult = validateDependencies(id, project);
    const epic = typeof entry.epic === "string" ? entry.epic : null;

    backlogStories.push({
      id,
      title: id, // We use ID as title since story files aren't always available
      epic,
      isBlocked: depResult.blocked,
      blockers: depResult.blockers.map((b) => b.id),
    });
  }

  // Sort: unblocked first, then by epic grouping
  backlogStories.sort((a, b) => {
    if (a.isBlocked !== b.isBlocked) return a.isBlocked ? 1 : -1;
    // Group by epic
    const epicA = a.epic ?? "";
    const epicB = b.epic ?? "";
    if (epicA !== epicB) return epicA.localeCompare(epicB);
    return a.id.localeCompare(b.id);
  });

  // Config
  const startDate = readConfigString(project, "sprintStartDate");
  const endDate = readConfigString(project, "sprintEndDate");
  const goal = readConfigString(project, "sprintGoal");
  const targetVelocity = readConfigNumber(project, "targetVelocity");

  // Historical velocity
  let historicalVelocity = 0;
  try {
    const velResult = computeVelocityComparison(project);
    historicalVelocity = velResult.averageVelocity;
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

  return {
    backlogStories,
    recommended,
    sprintConfig: {
      startDate,
      endDate,
      goal,
      targetVelocity,
    },
    capacity: {
      historicalVelocity,
      targetVelocity,
      effectiveTarget,
      inProgressCount,
      remainingCapacity,
    },
    loadStatus,
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
  };
}
