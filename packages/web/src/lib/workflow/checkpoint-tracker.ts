/**
 * Checkpoint tracker (Story 20.2).
 *
 * Tracks WIP checkpoint commits for agent sessions.
 * Provides timeline data for dashboard display and rollback targets.
 * Pure module — no git I/O, works with provided data.
 */

/** A single checkpoint entry for an agent session. */
export interface Checkpoint {
  /** Checkpoint commit SHA (short). */
  sha: string;
  /** ISO 8601 timestamp when checkpoint was created. */
  timestamp: string;
  /** Number of files changed since last checkpoint. */
  filesChanged: number;
  /** Brief description. */
  message: string;
}

/** Checkpoint timeline for an agent session. */
export interface CheckpointTimeline {
  /** Agent/session identifier. */
  agentId: string;
  /** Ordered list of checkpoints (oldest first). */
  checkpoints: Checkpoint[];
  /** Whether auto-checkpointing is enabled. */
  enabled: boolean;
  /** Interval in minutes between checkpoints. */
  intervalMinutes: number;
}

/**
 * Create an empty checkpoint timeline for a new agent session.
 */
export function createTimeline(agentId: string, intervalMinutes: number = 10): CheckpointTimeline {
  return {
    agentId,
    checkpoints: [],
    enabled: true,
    intervalMinutes,
  };
}

/**
 * Add a checkpoint to the timeline.
 */
export function addCheckpoint(
  timeline: CheckpointTimeline,
  checkpoint: Checkpoint,
): CheckpointTimeline {
  return {
    ...timeline,
    checkpoints: [...timeline.checkpoints, checkpoint],
  };
}

/**
 * Find the best rollback target (most recent checkpoint before a given time).
 */
export function findRollbackTarget(
  timeline: CheckpointTimeline,
  beforeTimestamp?: string,
): Checkpoint | null {
  const target = beforeTimestamp ?? new Date().toISOString();
  const candidates = timeline.checkpoints.filter((c) => c.timestamp <= target);
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

/**
 * Get the number of checkpoints in the timeline.
 */
export function getCheckpointCount(timeline: CheckpointTimeline): number {
  return timeline.checkpoints.length;
}
