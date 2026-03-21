/**
 * Burndown Service
 *
 * Provides event-driven sprint burndown recalculation.
 * When a story completes, recalculates remaining/completed counts
 * and caches the result for fast access by downstream consumers
 * (CLI `ao burndown`, Dashboard BurndownChart).
 */

import type { EventBusEvent } from "./types.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

// ---------------------------------------------------------------------------
// Interfaces (co-located, not in types.ts to avoid further bloat)
// ---------------------------------------------------------------------------

export interface BurndownServiceConfig {
  projectPath: string;
  sprintStartDate?: string; // ISO date (YYYY-MM-DD), optional
  sprintEndDate?: string; // ISO date (YYYY-MM-DD), optional
}

export interface BurndownData {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Stories remaining */
  remaining: number;
  /** Cumulative completed */
  completed: number;
  /** Ideal burndown value for this day */
  idealRemaining: number;
}

export interface BurndownResult {
  totalStories: number;
  completedStories: number;
  remainingStories: number;
  completionPercentage: number;
  sprintStart: string | null;
  sprintEnd: string | null;
  dailyData: BurndownData[];
  currentPace: "ahead" | "on-pace" | "behind" | "no-data";
  totalPoints?: number;
  completedPoints?: number;
  remainingPoints?: number;
  lastUpdated: string;
}

export interface BurndownService {
  /** Recalculate burndown from current sprint state */
  recalculate(): BurndownResult;
  /** Handle a story.completed event (triggers recalculate) */
  onStoryCompleted(event: EventBusEvent): Promise<void>;
  /** Get the latest cached burndown result */
  getResult(): BurndownResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORY_KEY_PATTERN = /^\d+-\d+-/;

function isStoryKey(key: string): boolean {
  return STORY_KEY_PATTERN.test(key) && !key.startsWith("epic-") && !key.includes("retrospective");
}

function loadSprintStatus(projectPath: string): Record<string, unknown> | null {
  const statusPath = join(projectPath, "sprint-status.yaml");
  if (!existsSync(statusPath)) {
    return null;
  }
  try {
    const content = readFileSync(statusPath, "utf-8");
    return parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Build an ideal burndown line — linear decline from total at start to 0 at end.
 * Returns one data point per day from sprintStart to sprintEnd.
 */
function buildIdealLine(
  totalStories: number,
  sprintStart: string,
  sprintEnd: string,
): BurndownData[] {
  const start = new Date(sprintStart);
  const end = new Date(sprintEnd);
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const points: BurndownData[] = [];

  for (let i = 0; i <= totalDays; i++) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const idealRemaining = Math.max(0, totalStories - (totalStories * i) / totalDays);

    points.push({
      date: date.toISOString().slice(0, 10),
      remaining: totalStories, // will be overwritten with actuals if available
      completed: 0,
      idealRemaining: Math.round(idealRemaining * 100) / 100,
    });
  }

  return points;
}

/**
 * Determine pace by comparing actual remaining to ideal remaining at today's position.
 */
function determinePace(
  totalStories: number,
  completedStories: number,
  sprintStart: string | null,
  sprintEnd: string | null,
): "ahead" | "on-pace" | "behind" | "no-data" {
  if (totalStories === 0) return "no-data";
  if (!sprintStart || !sprintEnd) return "no-data";

  const now = new Date();
  const start = new Date(sprintStart);
  const end = new Date(sprintEnd);

  if (now < start) return "on-pace"; // Sprint hasn't started yet
  if (now > end) {
    return completedStories >= totalStories ? "ahead" : "behind";
  }

  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  const idealCompleted = (totalStories * elapsedDays) / totalDays;
  const tolerance = 0.5; // Half a story tolerance for "on-pace"

  if (completedStories > idealCompleted + tolerance) return "ahead";
  if (completedStories < idealCompleted - tolerance) return "behind";
  return "on-pace";
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function emptyResult(): BurndownResult {
  return {
    totalStories: 0,
    completedStories: 0,
    remainingStories: 0,
    completionPercentage: 0,
    sprintStart: null,
    sprintEnd: null,
    dailyData: [],
    currentPace: "no-data",
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create a BurndownService instance.
 */
export function createBurndownService(config: BurndownServiceConfig): BurndownService {
  const { projectPath, sprintStartDate, sprintEndDate } = config;

  let cachedResult: BurndownResult = emptyResult();

  function recalculate(): BurndownResult {
    try {
      const sprintStatus = loadSprintStatus(projectPath);
      if (!sprintStatus) {
        cachedResult = emptyResult();
        return cachedResult;
      }

      const devStatus = sprintStatus.development_status as Record<string, string> | undefined;
      if (!devStatus) {
        cachedResult = emptyResult();
        return cachedResult;
      }

      // Count stories by status
      let totalStories = 0;
      let completedStories = 0;
      const priorities = sprintStatus.priorities as Record<string, number> | undefined;
      let totalPoints = 0;
      let completedPoints = 0;
      let hasPoints = false;

      for (const [key, status] of Object.entries(devStatus)) {
        if (!isStoryKey(key)) continue;
        totalStories++;

        const storyPoints = priorities?.[key];
        if (typeof storyPoints === "number") {
          hasPoints = true;
          totalPoints += storyPoints;
        }

        if (status === "done") {
          completedStories++;
          if (typeof storyPoints === "number") {
            completedPoints += storyPoints;
          }
        }
      }

      const remainingStories = totalStories - completedStories;
      const completionPercentage = totalStories > 0 ? (completedStories / totalStories) * 100 : 0;

      // Determine sprint dates
      const sprintStart = sprintStartDate ?? null;
      const sprintEnd = sprintEndDate ?? null;

      // Build daily data (ideal line) if sprint dates are available
      let dailyData: BurndownData[] = [];
      if (sprintStart && sprintEnd) {
        dailyData = buildIdealLine(totalStories, sprintStart, sprintEnd);

        // Set actual remaining on today's data point
        const today = new Date().toISOString().slice(0, 10);
        for (const point of dailyData) {
          if (point.date <= today) {
            point.remaining = remainingStories;
            point.completed = completedStories;
          }
        }
      } else {
        // No sprint dates — single data point with current state
        dailyData = [
          {
            date: new Date().toISOString().slice(0, 10),
            remaining: remainingStories,
            completed: completedStories,
            idealRemaining: remainingStories,
          },
        ];
      }

      const currentPace = determinePace(totalStories, completedStories, sprintStart, sprintEnd);

      cachedResult = {
        totalStories,
        completedStories,
        remainingStories,
        completionPercentage: Math.round(completionPercentage * 100) / 100,
        sprintStart,
        sprintEnd,
        dailyData,
        currentPace,
        lastUpdated: new Date().toISOString(),
        ...(hasPoints
          ? {
              totalPoints,
              completedPoints,
              remainingPoints: totalPoints - completedPoints,
            }
          : {}),
      };

      return cachedResult;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[burndown-service] Burndown recalculation failed:", err);
      return cachedResult;
    }
  }

  // Initial calculation
  recalculate();

  return {
    recalculate,

    async onStoryCompleted(_event: EventBusEvent): Promise<void> {
      try {
        recalculate();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[burndown-service] Failed to handle story.completed:", err);
      }
    },

    getResult(): BurndownResult {
      return cachedResult;
    },
  };
}
