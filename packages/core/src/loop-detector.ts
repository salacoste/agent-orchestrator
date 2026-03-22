/**
 * Loop Detector — Agent restart cycle breaker (Story 43.5).
 *
 * Tracks how many times an agent has been restarted/resumed for the same story.
 * When the count exceeds the threshold, the agent is flagged as looping.
 * Tracks session lifecycle events only (not token usage — that's scope creep).
 */

/** Loop detection status for an agent. */
export interface LoopStatus {
  agentId: string;
  storyId: string;
  restartCount: number;
  threshold: number;
  isLooping: boolean;
}

/** Loop detector interface. */
export interface LoopDetector {
  /** Record a restart/resume event. Returns true if loop detected (threshold reached). */
  recordRestart(agentId: string, storyId: string): boolean;
  /** Get loop status for an agent. */
  getStatus(agentId: string): LoopStatus | null;
  /** Reset restart count for an agent (manual recovery). */
  reset(agentId: string): void;
  /** Get all agents currently flagged as looping. */
  getLoopingAgents(): LoopStatus[];
}

/**
 * Create a loop detector with configurable threshold.
 *
 * @param threshold — restart count that triggers loop detection (default: 3)
 */
export function createLoopDetector(threshold: number = 3): LoopDetector {
  // Key: "agentId:storyId", Value: restart count
  const counts = new Map<string, { agentId: string; storyId: string; count: number }>();

  function getKey(agentId: string, storyId: string): string {
    return `${agentId}\0${storyId}`; // Null byte separator avoids ID collision
  }

  return {
    recordRestart(agentId: string, storyId: string): boolean {
      const key = getKey(agentId, storyId);
      const existing = counts.get(key);
      const newCount = (existing?.count ?? 0) + 1;
      counts.set(key, { agentId, storyId, count: newCount });
      return newCount >= threshold;
    },

    getStatus(agentId: string): LoopStatus | null {
      // Find entry with highest restart count for this agent
      let worst: { agentId: string; storyId: string; count: number } | null = null;
      for (const entry of counts.values()) {
        if (entry.agentId === agentId && (!worst || entry.count > worst.count)) {
          worst = entry;
        }
      }
      if (!worst) return null;
      return {
        agentId: worst.agentId,
        storyId: worst.storyId,
        restartCount: worst.count,
        threshold,
        isLooping: worst.count >= threshold,
      };
    },

    reset(agentId: string): void {
      // Collect keys first to avoid mutating Map during iteration
      const keysToDelete = [...counts.entries()]
        .filter(([, entry]) => entry.agentId === agentId)
        .map(([key]) => key);
      for (const key of keysToDelete) {
        counts.delete(key);
      }
    },

    getLoopingAgents(): LoopStatus[] {
      const looping: LoopStatus[] = [];
      for (const entry of counts.values()) {
        if (entry.count >= threshold) {
          looping.push({
            agentId: entry.agentId,
            storyId: entry.storyId,
            restartCount: entry.count,
            threshold,
            isLooping: true,
          });
        }
      }
      return looping;
    },
  };
}
