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
    return `${agentId}:${storyId}`;
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
      // Find any entry for this agent
      for (const [, entry] of counts) {
        if (entry.agentId === agentId) {
          return {
            agentId: entry.agentId,
            storyId: entry.storyId,
            restartCount: entry.count,
            threshold,
            isLooping: entry.count >= threshold,
          };
        }
      }
      return null;
    },

    reset(agentId: string): void {
      for (const [key, entry] of counts) {
        if (entry.agentId === agentId) {
          counts.delete(key);
        }
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
