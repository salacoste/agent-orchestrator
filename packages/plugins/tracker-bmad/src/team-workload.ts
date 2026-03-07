/**
 * Team workload analysis — per-assignee story distribution,
 * overload detection, and unassigned story tracking.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readSprintStatus, getEpicStoryIds } from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_OVERLOAD_LIMIT = 3;
const IN_FLIGHT_COLUMNS = new Set(["in-progress", "review"]);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StoryRef {
  storyId: string;
  column: string;
  points?: number;
}

export interface TeamMember {
  sessionId: string;
  storiesByColumn: Record<string, string[]>; // column → storyIds
  totalInFlight: number;
  totalPoints: number;
  isOverloaded: boolean;
}

export interface TeamWorkloadResult {
  members: TeamMember[];
  overloaded: string[]; // sessionIds exceeding threshold
  unassigned: StoryRef[]; // stories with no assignedSession
  overloadThreshold: number;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeTeamWorkload(
  project: ProjectConfig,
  epicFilter?: string,
): TeamWorkloadResult {
  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return {
      members: [],
      overloaded: [],
      unassigned: [],
      overloadThreshold: DEFAULT_OVERLOAD_LIMIT,
    };
  }

  const epicStoryIds = epicFilter ? getEpicStoryIds(sprint, epicFilter) : null;

  // Read overload threshold from config
  const rawLimit = project.tracker?.["teamOverloadLimit"];
  const overloadThreshold =
    typeof rawLimit === "number" && rawLimit > 0 ? rawLimit : DEFAULT_OVERLOAD_LIMIT;

  // Group stories by assignedSession
  const memberMap = new Map<string, TeamMember>();
  const unassigned: StoryRef[] = [];

  for (const [id, entry] of Object.entries(sprint.development_status)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";

    // Skip epic-level entries and done stories
    if (id.startsWith("epic-") || status.startsWith("epic-")) continue;
    if (status === "done") continue;
    if (epicStoryIds && !epicStoryIds.has(id)) continue;

    const sessionId = entry.assignedSession;
    const points = typeof entry.points === "number" ? entry.points : undefined;

    if (!sessionId) {
      unassigned.push({ storyId: id, column: status, points });
      continue;
    }

    let member = memberMap.get(sessionId);
    if (!member) {
      member = {
        sessionId,
        storiesByColumn: {},
        totalInFlight: 0,
        totalPoints: 0,
        isOverloaded: false,
      };
      memberMap.set(sessionId, member);
    }

    // Add to column group
    if (!member.storiesByColumn[status]) {
      member.storiesByColumn[status] = [];
    }
    member.storiesByColumn[status].push(id);

    // Count in-flight
    if (IN_FLIGHT_COLUMNS.has(status)) {
      member.totalInFlight++;
    }

    // Sum points
    member.totalPoints += points ?? 1;
  }

  // Check overload
  const overloaded: string[] = [];
  for (const member of memberMap.values()) {
    if (member.totalInFlight > overloadThreshold) {
      member.isOverloaded = true;
      overloaded.push(member.sessionId);
    }
  }

  return {
    members: Array.from(memberMap.values()),
    overloaded,
    unassigned,
    overloadThreshold,
  };
}
