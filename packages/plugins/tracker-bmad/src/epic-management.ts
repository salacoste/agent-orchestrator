/**
 * Epic management — create, rename, delete, and list epics.
 *
 * Epics are markdown files (epic-{slug}.md) in the story directory.
 * This module provides CRUD operations on epic files and cross-references
 * with sprint-status.yaml for progress tracking.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import type { ProjectConfig } from "@composio/ao-core";
import {
  readSprintStatus,
  getOutputDir,
  getEpicStoryIds,
  sprintStatusPath,
  type SprintStatus,
} from "./sprint-status-reader.js";

// ---------------------------------------------------------------------------
// Path helpers (duplicated from index.ts to avoid circular deps)
// ---------------------------------------------------------------------------

function getStoryDir(project: ProjectConfig): string {
  const v = project.tracker?.["storyDir"];
  return typeof v === "string" ? v : "implementation-artifacts";
}

function epicFilePath(epicSlug: string, project: ProjectConfig): string {
  return join(project.path, getOutputDir(project), getStoryDir(project), `epic-${epicSlug}.md`);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EpicInfo {
  id: string;
  title: string;
  storyCount: number;
  doneCount: number;
  progress: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function listEpics(project: ProjectConfig): EpicInfo[] {
  let sprint: SprintStatus;
  try {
    sprint = readSprintStatus(project);
  } catch {
    return [];
  }

  // Collect unique epic IDs from sprint status
  const epicIds = new Set<string>();
  for (const entry of Object.values(sprint.development_status)) {
    if (entry.epic && typeof entry.epic === "string") {
      epicIds.add(entry.epic);
    }
  }

  const results: EpicInfo[] = [];
  for (const epicId of epicIds) {
    const filePath = epicFilePath(epicId, project);
    let title = epicId;
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        title = extractTitle(content, epicId);
      } catch {
        // Fall back to epicId
      }
    }

    const storyIds = getEpicStoryIds(sprint, epicId);
    let doneCount = 0;
    for (const storyId of storyIds) {
      const entry = sprint.development_status[storyId];
      if (entry && entry.status === "done") {
        doneCount++;
      }
    }

    const storyCount = storyIds.size;
    const progress = storyCount > 0 ? Math.round((doneCount / storyCount) * 100) : 0;

    results.push({ id: epicId, title, storyCount, doneCount, progress });
  }

  results.sort((a, b) => a.id.localeCompare(b.id));
  return results;
}

export function createEpic(
  project: ProjectConfig,
  title: string,
  description?: string,
): { epicId: string; filePath: string } {
  if (!title || !title.trim()) {
    throw new Error("Epic title is required");
  }

  const slug = slugify(title);
  if (!slug) {
    throw new Error("Epic title must contain at least one alphanumeric character");
  }

  const epicId = `epic-${slug}`;
  const filePath = epicFilePath(epicId, project);

  if (existsSync(filePath)) {
    throw new Error(`Epic already exists: ${epicId}`);
  }

  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lines = [`# ${title.trim()}`, ""];
  if (description) {
    lines.push(description.trim(), "");
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
  return { epicId, filePath };
}

export function renameEpic(project: ProjectConfig, epicId: string, newTitle: string): void {
  if (!newTitle || !newTitle.trim()) {
    throw new Error("New title is required");
  }

  const filePath = epicFilePath(epicId, project);
  if (!existsSync(filePath)) {
    throw new Error(`Epic not found: ${epicId}`);
  }

  let content = readFileSync(filePath, "utf-8");
  const h1Match = content.match(/^#\s+.+$/m);
  if (h1Match) {
    content = content.replace(h1Match[0], `# ${newTitle.trim()}`);
  } else {
    content = `# ${newTitle.trim()}\n\n${content}`;
  }

  writeFileSync(filePath, content, "utf-8");
}

export function deleteEpic(
  project: ProjectConfig,
  epicId: string,
  opts?: { clearStories?: boolean },
): { affectedStories: string[] } {
  const filePath = epicFilePath(epicId, project);
  if (!existsSync(filePath)) {
    throw new Error(`Epic not found: ${epicId}`);
  }

  const affectedStories: string[] = [];
  try {
    const sprint = readSprintStatus(project);
    const storyIds = getEpicStoryIds(sprint, epicId);
    affectedStories.push(...storyIds);

    if (opts?.clearStories && storyIds.size > 0) {
      const statusPath = sprintStatusPath(project);
      for (const storyId of storyIds) {
        const entry = sprint.development_status[storyId];
        if (entry) {
          delete entry.epic;
        }
      }
      const tmpPath = statusPath + `.tmp.${process.pid}.${Date.now()}`;
      writeFileSync(tmpPath, stringifyYaml(sprint), "utf-8");
      renameSync(tmpPath, statusPath);
    }
  } catch {
    // Sprint status unavailable — just delete the file
  }

  unlinkSync(filePath);
  return { affectedStories };
}
