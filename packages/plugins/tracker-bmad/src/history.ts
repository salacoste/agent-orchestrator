import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import type { ProjectConfig } from "@composio/ao-core";

export interface HistoryEntry {
  timestamp: string;
  storyId: string;
  fromStatus: string;
  toStatus: string;
  /** Optional comment attached to this entry (audit trail). */
  comment?: string;
  /** Sprint number this entry belongs to (set during archival). */
  sprintNumber?: number;
}

export function historyPath(project: ProjectConfig): string {
  const raw = project.tracker?.["outputDir"];
  const outputDir = typeof raw === "string" ? raw : "_bmad-output";
  return join(project.path, outputDir, "sprint-history.jsonl");
}

export function appendHistory(
  project: ProjectConfig,
  storyId: string,
  fromStatus: string,
  toStatus: string,
): void {
  const entry: HistoryEntry = {
    timestamp: new Date().toISOString(),
    storyId,
    fromStatus,
    toStatus,
  };
  try {
    const filePath = historyPath(project);
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Non-fatal — history is best-effort
  }
}

export function appendComment(
  project: ProjectConfig,
  storyId: string,
  comment: string,
  currentStatus: string,
): void {
  const entry: HistoryEntry = {
    timestamp: new Date().toISOString(),
    storyId,
    fromStatus: currentStatus,
    toStatus: currentStatus,
    comment,
  };
  try {
    const filePath = historyPath(project);
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Non-fatal — history is best-effort
  }
}

export function readHistory(project: ProjectConfig): HistoryEntry[] {
  const filePath = historyPath(project);
  if (!existsSync(filePath)) return [];
  try {
    const content = readFileSync(filePath, "utf-8");
    const entries: HistoryEntry[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof (parsed as Record<string, unknown>).timestamp === "string" &&
          typeof (parsed as Record<string, unknown>).storyId === "string" &&
          typeof (parsed as Record<string, unknown>).fromStatus === "string" &&
          typeof (parsed as Record<string, unknown>).toStatus === "string"
        ) {
          // Validate ISO-8601 date prefix (YYYY-MM-DD) so consumers can safely slice(0,10)
          const ts = (parsed as Record<string, unknown>).timestamp as string;
          if (!/^\d{4}-\d{2}-\d{2}/.test(ts)) continue;
          entries.push(parsed as HistoryEntry);
        }
      } catch {
        // Skip malformed lines
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Archive the current sprint history to a dated file and clear the main history.
 *
 * Renames sprint-history.jsonl to sprint-history-{suffix}.jsonl.
 * Returns the archive file path, or null if there was nothing to archive.
 */
export function archiveHistory(project: ProjectConfig, suffix: string): string | null {
  const filePath = historyPath(project);
  if (!existsSync(filePath)) return null;

  const dir = dirname(filePath);
  const archivePath = join(dir, `sprint-history-${suffix}.jsonl`);
  renameSync(filePath, archivePath);
  return archivePath;
}

/**
 * Clear the current sprint history file (write empty).
 */
export function clearHistory(project: ProjectConfig): void {
  const filePath = historyPath(project);
  if (!existsSync(filePath)) return;
  writeFileSync(filePath, "", "utf-8");
}
