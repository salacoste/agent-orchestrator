/**
 * Forecast persistence — stores Monte Carlo forecast snapshots to JSONL for
 * later calibration comparison. Follows the sprint-history.jsonl pattern.
 */

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ProjectConfig } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ForecastSnapshot {
  /** ISO-8601 — when forecast was generated */
  timestamp: string;
  /** Project name */
  projectId: string;
  /** Optional epic filter used */
  epicFilter?: string;
  /** Predicted percentile dates */
  percentiles: {
    p50: string;
    p80: string;
    p95: string;
  };
  /** Stories remaining at forecast time */
  remainingStories: number;
  /** Number of simulations run */
  simulationCount: number;
  /** Filled in when the sprint completes — the actual completion date */
  actualCompletionDate?: string;
}

// ---------------------------------------------------------------------------
// Path helper
// ---------------------------------------------------------------------------

function forecastLogPath(project: ProjectConfig): string {
  const raw = project.tracker?.["outputDir"];
  const outputDir = typeof raw === "string" ? raw : "_bmad-output";
  return join(project.path, outputDir, "forecast-log.jsonl");
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Append a forecast snapshot to the JSONL log.
 * Non-fatal — silently catches write errors.
 */
export function appendForecastLog(
  project: ProjectConfig,
  snapshot: Omit<ForecastSnapshot, "actualCompletionDate">,
): void {
  const entry: ForecastSnapshot = {
    ...snapshot,
    actualCompletionDate: undefined,
  };
  try {
    const filePath = forecastLogPath(project);
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Non-fatal — forecast log is best-effort
  }
}

/**
 * Read all forecast log entries. Skips malformed lines.
 */
export function readForecastLog(project: ProjectConfig): ForecastSnapshot[] {
  const filePath = forecastLogPath(project);
  if (!existsSync(filePath)) return [];
  try {
    const content = readFileSync(filePath, "utf-8");
    const entries: ForecastSnapshot[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof (parsed as Record<string, unknown>).timestamp === "string" &&
          typeof (parsed as Record<string, unknown>).projectId === "string" &&
          (parsed as Record<string, unknown>).percentiles &&
          typeof ((parsed as Record<string, unknown>).percentiles as Record<string, unknown>)
            .p50 === "string"
        ) {
          entries.push(parsed as ForecastSnapshot);
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
 * Mark a forecast entry with the actual completion date.
 * Rewrites the entire JSONL file with the updated entry.
 */
export function markForecastActual(
  project: ProjectConfig,
  forecastTimestamp: string,
  actualDate: string,
): boolean {
  const entries = readForecastLog(project);
  const target = entries.find((e) => e.timestamp === forecastTimestamp);
  if (!target) return false;

  target.actualCompletionDate = actualDate;

  try {
    const filePath = forecastLogPath(project);
    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync(filePath, lines, "utf-8");
    return true;
  } catch {
    return false;
  }
}
