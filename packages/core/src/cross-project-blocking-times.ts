/**
 * Blocking Start Time Persistence — file-based store for tracking when
 * cross-project dependencies first became blocking (Story 51.5).
 *
 * Persists to cross-project-blocking-times.yaml alongside the config file.
 * Follows same pattern as CrossProjectDepFileStore in cross-project-deps.ts.
 *
 * FR-F3-5: Users receive notifications when cross-project dependencies are blocking progress.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse, stringify } from "yaml";
import {
  type BlockingStartTimeMap,
  type CrossProjectDependency,
  type DependencyBlockingAlert,
  type SprintDataMap,
  computeBlockingStartTimes,
  getBlockingAlerts,
  DEFAULT_BLOCKING_THRESHOLD_MS,
} from "./cross-project-deps.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default filename for the blocking start times file. */
export const BLOCKING_TIMES_FILENAME = "cross-project-blocking-times.yaml";

// =============================================================================
// STORE INTERFACE
// =============================================================================

/** Store interface for blocking start time persistence. */
export interface BlockingTimesStore {
  /** Load blocking start times from disk. Returns empty map if file doesn't exist. */
  load(): BlockingStartTimeMap;
  /** Save blocking start times to disk. */
  save(times: BlockingStartTimeMap): void;
  /**
   * Refresh blocking start times and compute alerts.
   * Updates persisted times based on current dep statuses and returns alerts.
   */
  refresh(
    deps: CrossProjectDependency[],
    sprintDataMap: SprintDataMap,
    thresholdMs?: number,
    now?: Date,
  ): { times: BlockingStartTimeMap; alerts: DependencyBlockingAlert[] };
}

// =============================================================================
// FILE-BASED STORE
// =============================================================================

/**
 * File-based store for blocking start times.
 * Persists to cross-project-blocking-times.yaml alongside the orchestrator config.
 */
export class BlockingTimesFileStore implements BlockingTimesStore {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): BlockingStartTimeMap {
    if (!existsSync(this.filePath)) {
      return {};
    }
    try {
      const content = readFileSync(this.filePath, "utf-8");
      const data = parse(content);
      if (
        data &&
        typeof data === "object" &&
        data.blockingStartTimes !== null &&
        data.blockingStartTimes !== undefined &&
        typeof data.blockingStartTimes === "object" &&
        !Array.isArray(data.blockingStartTimes)
      ) {
        // Validate each value is a string (ISO timestamp)
        const result: BlockingStartTimeMap = {};
        for (const [key, value] of Object.entries(
          data.blockingStartTimes as Record<string, unknown>,
        )) {
          if (typeof value === "string") {
            result[key] = value;
          }
        }
        return result;
      }
      return {};
    } catch (err) {
      console.warn(
        "Failed to load blocking start times:",
        err instanceof Error ? err.message : err,
      );
      return {};
    }
  }

  save(times: BlockingStartTimeMap): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, stringify({ blockingStartTimes: times }));
  }

  refresh(
    deps: CrossProjectDependency[],
    sprintDataMap: SprintDataMap,
    thresholdMs: number = DEFAULT_BLOCKING_THRESHOLD_MS,
    now?: Date,
  ): { times: BlockingStartTimeMap; alerts: DependencyBlockingAlert[] } {
    const currentTimes = this.load();
    const times = computeBlockingStartTimes(deps, sprintDataMap, currentTimes, now);

    // Only persist if times changed
    if (JSON.stringify(times) !== JSON.stringify(currentTimes)) {
      this.save(times);
    }

    const alerts = getBlockingAlerts(deps, sprintDataMap, times, thresholdMs, now);

    return { times, alerts };
  }
}

/**
 * Create a BlockingTimesFileStore from the config file path.
 * The blocking times file lives alongside the config file.
 */
export function createBlockingTimesStore(configPath: string): BlockingTimesFileStore {
  const dir = dirname(configPath);
  return new BlockingTimesFileStore(join(dir, BLOCKING_TIMES_FILENAME));
}
