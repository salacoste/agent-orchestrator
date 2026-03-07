/**
 * Standup report generator — produces a structured daily standup report
 * with completed stories, in-progress work, blockers, health metrics,
 * and rework alerts.
 */

import type { ProjectConfig } from "@composio/ao-core";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readHistory } from "./history.js";
import { readSprintStatus, getOutputDir, getEpicStoryIds } from "./sprint-status-reader.js";
import { getDoneColumn, getActiveColumns, isBackwardTransition } from "./workflow-columns.js";
import { computeForecast } from "./forecast.js";
import { validateDependencies } from "./dependencies.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StandupReport {
  generatedAt: string;
  projectName: string;
  completedYesterday: Array<{ storyId: string; title: string; completedAt: string }>;
  inProgress: Array<{
    storyId: string;
    title: string;
    status: string;
    ageMs: number;
    assignedSession?: string;
  }>;
  blocked: Array<{ storyId: string; title: string; reason: string }>;
  health: {
    pace: string;
    remainingStories: number;
    totalStories: number;
    completedStories: number;
    projectedCompletion: string | null;
  };
  reworkAlerts: Array<{ storyId: string; from: string; to: string; timestamp: string }>;
  markdown: string;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getStoryDir(project: ProjectConfig): string {
  const v = project.tracker?.["storyDir"];
  return typeof v === "string" ? v : "implementation-artifacts";
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readFileOrNull(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function extractTitle(content: string, fallbackSlug: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallbackSlug;
}

function resolveStoryTitle(storyId: string, project: ProjectConfig): string {
  const storyPath = join(
    project.path,
    getOutputDir(project),
    getStoryDir(project),
    `story-${storyId}.md`,
  );
  const content = readFileOrNull(storyPath);
  if (!content) return storyId;
  return extractTitle(content, storyId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STUCK_THRESHOLD_MS = 48 * 60 * 60 * 1000;

function formatMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

// ---------------------------------------------------------------------------
// Markdown formatter
// ---------------------------------------------------------------------------

function formatMarkdown(report: Omit<StandupReport, "markdown">): string {
  const lines: string[] = [];

  lines.push(`# Standup Report: ${report.projectName}`);
  lines.push("");
  lines.push(`_Generated: ${report.generatedAt}_`);
  lines.push("");

  // Completed yesterday
  lines.push("## Completed Yesterday");
  lines.push("");
  if (report.completedYesterday.length === 0) {
    lines.push("_No stories completed in the last 24h._");
  } else {
    for (const story of report.completedYesterday) {
      lines.push(`- **${story.storyId}**: ${story.title} (completed ${story.completedAt})`);
    }
  }
  lines.push("");

  // In progress
  lines.push("## In Progress");
  lines.push("");
  if (report.inProgress.length === 0) {
    lines.push("_No stories currently in progress._");
  } else {
    for (const story of report.inProgress) {
      const session = story.assignedSession ? ` [${story.assignedSession}]` : "";
      lines.push(
        `- **${story.storyId}**: ${story.title} — ${story.status} (${formatMs(story.ageMs)})${session}`,
      );
    }
  }
  lines.push("");

  // Blocked
  lines.push("## Blocked");
  lines.push("");
  if (report.blocked.length === 0) {
    lines.push("_No blocked stories._");
  } else {
    for (const story of report.blocked) {
      lines.push(`- **${story.storyId}**: ${story.title} — ${story.reason}`);
    }
  }
  lines.push("");

  // Rework alerts
  if (report.reworkAlerts.length > 0) {
    lines.push("## Rework Alerts");
    lines.push("");
    for (const alert of report.reworkAlerts) {
      lines.push(`- **${alert.storyId}**: ${alert.from} -> ${alert.to} (${alert.timestamp})`);
    }
    lines.push("");
  }

  // Health
  lines.push("## Sprint Health");
  lines.push("");
  lines.push(`- Pace: **${report.health.pace}**`);
  lines.push(
    `- Progress: ${report.health.completedStories}/${report.health.totalStories} stories (${report.health.remainingStories} remaining)`,
  );
  if (report.health.projectedCompletion) {
    lines.push(`- Projected completion: ${report.health.projectedCompletion}`);
  }
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateStandup(project: ProjectConfig, epicFilter?: string): StandupReport {
  const now = Date.now();
  const yesterday = now - MS_PER_DAY;
  const generatedAt = new Date(now).toISOString();
  const projectName = project.name || "Unknown";

  // Read sprint status
  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch {
    const emptyReport: Omit<StandupReport, "markdown"> = {
      generatedAt,
      projectName,
      completedYesterday: [],
      inProgress: [],
      blocked: [],
      health: {
        pace: "no-data",
        remainingStories: 0,
        totalStories: 0,
        completedStories: 0,
        projectedCompletion: null,
      },
      reworkAlerts: [],
    };
    return { ...emptyReport, markdown: formatMarkdown(emptyReport) };
  }

  const epicStoryIds = epicFilter ? getEpicStoryIds(sprint, epicFilter) : null;
  const history = readHistory(project);
  const doneColumn = getDoneColumn(project);
  const activeColumns = getActiveColumns(project);

  // 1. Completed yesterday: find transitions to done in the last 24h
  const completedYesterday: StandupReport["completedYesterday"] = [];
  const completedSet = new Set<string>();

  for (const entry of history) {
    if (epicStoryIds && !epicStoryIds.has(entry.storyId)) continue;
    const ts = new Date(entry.timestamp).getTime();
    if (ts >= yesterday && entry.toStatus === doneColumn) {
      if (!completedSet.has(entry.storyId)) {
        completedSet.add(entry.storyId);
        completedYesterday.push({
          storyId: entry.storyId,
          title: resolveStoryTitle(entry.storyId, project),
          completedAt: entry.timestamp,
        });
      }
    }
  }

  // 2. In-progress stories: stories in active columns with age from last transition
  const inProgress: StandupReport["inProgress"] = [];

  // Build last transition map
  const lastTransitionMap = new Map<string, string>();
  for (const entry of history) {
    lastTransitionMap.set(entry.storyId, entry.timestamp);
  }

  for (const [id, entry] of Object.entries(sprint.development_status)) {
    if (id.startsWith("epic-")) continue;
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (status.startsWith("epic-")) continue;
    if (epicStoryIds && !epicStoryIds.has(id)) continue;
    if (!activeColumns.has(status)) continue;

    const lastTs = lastTransitionMap.get(id);
    const transitionTime = lastTs ? new Date(lastTs).getTime() : now - 30 * MS_PER_DAY;
    const ageMs = now - transitionTime;

    inProgress.push({
      storyId: id,
      title: resolveStoryTitle(id, project),
      status,
      ageMs,
      assignedSession: entry.assignedSession,
    });
  }

  // 3. Blocked stories: dependency validation + stuck > 48h
  const blocked: StandupReport["blocked"] = [];

  for (const story of inProgress) {
    const depResult = validateDependencies(story.storyId, project);
    if (depResult.blocked) {
      const blockerIds = depResult.blockers.map((b) => `${b.id} (${b.status})`).join(", ");
      blocked.push({
        storyId: story.storyId,
        title: story.title,
        reason: `Blocked by: ${blockerIds}`,
      });
    } else if (story.ageMs > STUCK_THRESHOLD_MS) {
      blocked.push({
        storyId: story.storyId,
        title: story.title,
        reason: `Stuck for ${formatMs(story.ageMs)} (>${formatMs(STUCK_THRESHOLD_MS)})`,
      });
    }
  }

  // 4. Health from forecast
  const forecast = computeForecast(project, epicFilter);
  const health: StandupReport["health"] = {
    pace: forecast.pace,
    remainingStories: forecast.remainingStories,
    totalStories: forecast.totalStories,
    completedStories: forecast.completedStories,
    projectedCompletion: forecast.projectedCompletionDate,
  };

  // 5. Rework alerts: backward transitions in last 24h
  const reworkAlerts: StandupReport["reworkAlerts"] = [];

  for (const entry of history) {
    if (epicStoryIds && !epicStoryIds.has(entry.storyId)) continue;
    const ts = new Date(entry.timestamp).getTime();
    if (ts >= yesterday && isBackwardTransition(project, entry.fromStatus, entry.toStatus)) {
      reworkAlerts.push({
        storyId: entry.storyId,
        from: entry.fromStatus,
        to: entry.toStatus,
        timestamp: entry.timestamp,
      });
    }
  }

  // 6. Format markdown and return
  const partial: Omit<StandupReport, "markdown"> = {
    generatedAt,
    projectName,
    completedYesterday,
    inProgress,
    blocked,
    health,
    reworkAlerts,
  };

  return { ...partial, markdown: formatMarkdown(partial) };
}
