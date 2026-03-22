/**
 * Wired cascade detector (Story 39.3).
 *
 * Wraps the base cascade detector with automatic failure recording
 * from session snapshot data. Tracks which agents have already been
 * counted to avoid double-counting on repeated polls.
 */
import { createCascadeDetector, type CascadeConfig, type CascadeStatus } from "./cascade-detector";

/** Minimal session shape needed for cascade detection. */
export interface SessionSnapshot {
  id: string;
  status: string;
}

/**
 * Statuses that count as agent failures for cascade detection.
 * Note: `changes_requested` is excluded — it's human feedback, not a system failure.
 * Only automated/system failures should trigger cascade alerts.
 */
const FAILURE_STATUSES = new Set(["blocked", "ci_failed"]);

/** Wired cascade detector API. */
export interface WiredCascadeDetector {
  /** Process a session snapshot array, recording any new failures. Returns true if cascade triggered. */
  processSnapshot(sessions: SessionSnapshot[]): boolean;
  /** Get current cascade status. */
  getStatus(): CascadeStatus;
  /** Resume from cascade pause (manual action). */
  resume(): void;
  /** Reset all state (for testing). */
  reset(): void;
}

/**
 * Create a cascade detector that auto-records failures from session snapshots.
 *
 * Call `processSnapshot()` with the latest session list on each poll interval.
 * The detector tracks which agents are already counted as failed and only
 * records new failures (or agents that recovered and failed again).
 */
export function createWiredCascadeDetector(config?: Partial<CascadeConfig>): WiredCascadeDetector {
  const detector = createCascadeDetector(config);
  const seenFailures = new Set<string>();

  return {
    processSnapshot(sessions: SessionSnapshot[]): boolean {
      let cascadeTriggered = false;

      // Find currently-failed agents
      const currentFailures = new Set<string>();
      for (const session of sessions) {
        if (FAILURE_STATUSES.has(session.status)) {
          currentFailures.add(session.id);
        }
      }

      // Record new failures (agents that weren't already counted)
      for (const agentId of currentFailures) {
        if (!seenFailures.has(agentId)) {
          seenFailures.add(agentId);
          if (detector.recordFailure()) {
            cascadeTriggered = true;
          }
        }
      }

      // Clear agents that recovered (so they can be re-counted if they fail again).
      // Snapshot to avoid mutating Set during iteration.
      for (const agentId of [...seenFailures]) {
        if (!currentFailures.has(agentId)) {
          seenFailures.delete(agentId);
        }
      }

      return cascadeTriggered;
    },

    getStatus(): CascadeStatus {
      return detector.getStatus();
    },

    resume(): void {
      detector.resume();
      seenFailures.clear();
    },

    reset(): void {
      detector.reset();
      seenFailures.clear();
    },
  };
}
