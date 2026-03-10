/**
 * Sprint goals — computes progress against configured sprint goals.
 *
 * Supports four goal types:
 * - epic: % of stories in a specific epic that are done
 * - points: completed story points vs. a target
 * - stories: completed story count vs. a target
 * - custom: manual status from config
 */

import type { ProjectConfig } from "@composio/ao-core";
import {
  readSprintStatus,
  hasPointsData,
  getPoints,
  getEpicStoryIds,
} from "./sprint-status-reader.js";
import { computeForecast } from "./forecast.js";
import { computeMonteCarloForecast } from "./monte-carlo.js";
import { getDoneColumn } from "./workflow-columns.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SprintGoal {
  title: string;
  type: "epic" | "points" | "stories" | "custom";
  target: string | number | null;
  current: number | null;
  progress: number; // 0-100
  status: "pending" | "in-progress" | "done" | "at-risk";
  details: string;
  confidence: number;
}

export interface SprintGoalsResult {
  goals: SprintGoal[];
  overallProgress: number;
  onTrack: boolean;
  sprintEndDate: string | null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeSprintGoals(project: ProjectConfig): SprintGoalsResult {
  // Read sprintGoals from project.tracker config
  const raw = project.tracker?.["sprintGoals"];
  if (!Array.isArray(raw) || raw.length === 0) {
    return { goals: [], overallProgress: 0, onTrack: true, sprintEndDate: null };
  }

  const sprintEndDate =
    typeof project.tracker?.["sprintEndDate"] === "string"
      ? (project.tracker["sprintEndDate"] as string)
      : null;

  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return { goals: [], overallProgress: 0, onTrack: true, sprintEndDate };
  }

  const doneColumn = getDoneColumn(project);
  const pointsPresent = hasPointsData(sprint);
  const forecast = computeForecast(project);
  let monteCarlo: ReturnType<typeof computeMonteCarloForecast> | null = null;
  try {
    monteCarlo = computeMonteCarloForecast(project);
  } catch {
    // Non-fatal: confidence will be 0
  }

  const goals: SprintGoal[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title : "Untitled Goal";
    const type = parseGoalType(rec.type);
    const target = rec.target ?? null;

    let current: number | null = null;
    let progress = 0;
    let status: SprintGoal["status"] = "pending";
    let details = "";

    let confidence = 50; // Default confidence
    switch (type) {
      case "epic": {
        // Target is an epic ID — compute % of stories in that epic that are done
        const epicId = typeof target === "string" ? target : "";
        const epicStoryIds = getEpicStoryIds(sprint, epicId);
        let epicTotal = 0;
        let epicDone = 0;
        for (const [id, entry] of Object.entries(sprint.development_status)) {
          if (!epicStoryIds.has(id)) continue;
          const s = typeof entry.status === "string" ? entry.status : "backlog";
          if (id.startsWith("epic-") || s.startsWith("epic-")) continue;
          epicTotal++;
          if (s === doneColumn) epicDone++;
        }
        current = epicDone;
        progress = epicTotal > 0 ? Math.round((epicDone / epicTotal) * 100) : 0;
        details = `${epicDone}/${epicTotal} stories done`;
        if (progress >= 100) status = "done";
        else if (epicDone > 0) status = "in-progress";

        // Calculate confidence using epic-specific Monte Carlo
        if (monteCarlo && epicId) {
          try {
            const epicMc = computeMonteCarloForecast(project, epicId);
            if (epicMc.histogram?.length > 0 && sprintEndDate) {
              const endDate = new Date(sprintEndDate);
              const bucket = epicMc.histogram.find((h) => {
                const bucketDate = new Date(h.date);
                return Math.abs(bucketDate.getTime() - endDate.getTime()) < 12 * 60 * 60 * 1000;
              });
              if (bucket) {
                confidence = Math.min(100, bucket.cumulative * 100);
              }
            }
          } catch {
            // Use default confidence
          }
        }
        break;
      }
      case "points": {
        const targetPts = typeof target === "number" ? target : 0;
        // Count completed points
        let donePts = 0;
        for (const [id, entry] of Object.entries(sprint.development_status)) {
          const s = typeof entry.status === "string" ? entry.status : "backlog";
          if (id.startsWith("epic-") || s.startsWith("epic-")) continue;
          if (s === doneColumn) {
            donePts += pointsPresent ? getPoints(entry) : 1;
          }
        }
        current = donePts;
        progress = targetPts > 0 ? Math.min(100, Math.round((donePts / targetPts) * 100)) : 0;
        details = `${donePts}/${targetPts} points`;
        if (donePts >= targetPts && targetPts > 0) status = "done";
        else if (donePts > 0) status = "in-progress";

        // Calculate confidence using Monte Carlo
        confidence = 0;
        if (monteCarlo && sprintEndDate) {
          const endDate = new Date(sprintEndDate);
          const bucket = monteCarlo.histogram?.find((h) => {
            const bucketDate = new Date(h.date);
            return Math.abs(bucketDate.getTime() - endDate.getTime()) < 12 * 60 * 60 * 1000;
          });
          if (bucket) {
            confidence = Math.min(100, bucket.cumulative * 100);
          }
        } else if (progress >= 100) {
          confidence = 100;
        }
        break;
      }
      case "stories": {
        const targetCount = typeof target === "number" ? target : 0;
        let doneCount = 0;
        for (const [id, entry] of Object.entries(sprint.development_status)) {
          const s = typeof entry.status === "string" ? entry.status : "backlog";
          if (id.startsWith("epic-") || s.startsWith("epic-")) continue;
          if (s === doneColumn) doneCount++;
        }
        current = doneCount;
        progress = targetCount > 0 ? Math.min(100, Math.round((doneCount / targetCount) * 100)) : 0;
        details = `${doneCount}/${targetCount} stories`;
        if (doneCount >= targetCount && targetCount > 0) status = "done";
        else if (doneCount > 0) status = "in-progress";

        // Calculate confidence using Monte Carlo
        confidence = 0;
        if (monteCarlo && sprintEndDate) {
          const endDate = new Date(sprintEndDate);
          const bucket = monteCarlo.histogram?.find((h) => {
            const bucketDate = new Date(h.date);
            return Math.abs(bucketDate.getTime() - endDate.getTime()) < 12 * 60 * 60 * 1000;
          });
          if (bucket) {
            confidence = Math.min(100, bucket.cumulative * 100);
          }
        } else if (progress >= 100) {
          confidence = 100;
        }
        break;
      }
      case "custom": {
        // Manual status from config
        const manualStatus = typeof rec.status === "string" ? rec.status : "pending";
        if (manualStatus === "done") {
          status = "done";
          progress = 100;
        } else if (manualStatus === "in-progress") {
          status = "in-progress";
          progress = 50;
        } else {
          status = "pending";
          progress = 0;
        }
        details = `Manual: ${manualStatus}`;

        // Static confidence based on progress
        confidence = progress >= 100 ? 100 : progress >= 50 ? 75 : 25;
        break;
      }
    }

    // Check at-risk: if forecast says behind pace and goal is not done
    if (status !== "done" && forecast.pace === "behind") {
      status = "at-risk";
    }

    goals.push({
      title,
      type,
      target: target as string | number | null,
      current,
      progress,
      status,
      details,
      confidence: Math.round(confidence),
    });
  }

  const overallProgress =
    goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0;

  const onTrack = forecast.pace !== "behind" && goals.every((g) => g.status !== "at-risk");

  return { goals, overallProgress, onTrack, sprintEndDate };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseGoalType(val: unknown): SprintGoal["type"] {
  if (val === "epic") return "epic";
  if (val === "points") return "points";
  if (val === "stories") return "stories";
  return "custom";
}
