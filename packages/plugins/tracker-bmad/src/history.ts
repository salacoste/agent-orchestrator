import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ProjectConfig } from "@composio/ao-core";

export interface HistoryEntry {
  timestamp: string;
  storyId: string;
  fromStatus: string;
  toStatus: string;
}

function historyPath(project: ProjectConfig): string {
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
