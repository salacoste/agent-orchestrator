/**
 * Conflict Resolution Service
 *
 * Automatically resolves agent assignment conflicts using priority-based rules.
 * Provides tie-breaking strategies, graceful termination, and event publishing.
 *
 * Features:
 * - Priority-based resolution (keep highest priority agent)
 * - Tie-breaking: recent-wins or progress-wins
 * - Auto-resolution with configurable thresholds
 * - Manual resolution via CLI
 * - Graceful agent termination
 * - Resolution event publishing
 */

import type {
  AgentConflict,
  ConflictResolutionService,
  ConflictResolutionConfig,
  ResolutionResult,
  ResolutionStrategy,
  AgentRegistry,
  AgentAssignment,
  Runtime,
  RuntimeHandle,
} from "./types.js";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ResolutionStrategy = {
  autoResolve: false,
  tieBreaker: "recent",
  notifyOnResolution: true,
};

/**
 * Conflict Resolution Service Implementation
 */
class ConflictResolutionServiceImpl implements ConflictResolutionService {
  private registry: AgentRegistry;
  private runtime: Runtime;
  private config: ConflictResolutionConfig;

  constructor(
    registry: AgentRegistry,
    runtime: Runtime,
    config?: Partial<ConflictResolutionConfig>,
  ) {
    this.registry = registry;
    this.runtime = runtime;
    this.config = {
      autoResolve: config?.autoResolve ?? DEFAULT_CONFIG.autoResolve,
      tieBreaker: config?.tieBreaker ?? DEFAULT_CONFIG.tieBreaker,
      notifyOnResolution: config?.notifyOnResolution ?? DEFAULT_CONFIG.notifyOnResolution,
      eventPublisher: config?.eventPublisher,
    };
  }

  /**
   * Resolve a conflict using configured strategy
   */
  async resolve(conflict: AgentConflict): Promise<ResolutionResult> {
    const { existingAgent, conflictingAgent, priorityScores, conflictId } = conflict;

    // If auto-resolve is disabled, return manual
    if (!this.config.autoResolve) {
      return {
        conflictId,
        action: "manual",
        keptAgent: null,
        terminatedAgent: null,
        reason: "auto-resolve disabled - manual resolution required",
        resolvedAt: new Date(),
      };
    }

    // Get priority scores
    const existingScore = priorityScores[existingAgent] ?? 0.5;
    const conflictingScore = priorityScores[conflictingAgent] ?? 0.5;

    // Decision logic based on priority and tie-breaker
    let action: ResolutionResult["action"];
    let keptAgent: string | null;
    let terminatedAgent: string | null;
    let reason: string;

    if (Math.abs(existingScore - conflictingScore) > 0.001) {
      // Clear priority difference - keep higher priority
      if (existingScore > conflictingScore) {
        action = "keep_existing";
        keptAgent = existingAgent;
        terminatedAgent = conflictingAgent;
        reason = `higher priority (${existingScore.toFixed(2)} > ${conflictingScore.toFixed(2)})`;
      } else {
        action = "keep_new";
        keptAgent = conflictingAgent;
        terminatedAgent = existingAgent;
        reason = `higher priority (${conflictingScore.toFixed(2)} > ${existingScore.toFixed(2)})`;
      }
    } else {
      // Equal priority - use tie-breaker
      if (this.config.tieBreaker === "recent") {
        action = "keep_new";
        keptAgent = conflictingAgent;
        terminatedAgent = existingAgent;
        reason = `equal priority - ${conflictingAgent} is more recent, ${existingAgent} terminated`;
      } else {
        // progress tie-breaker - agent with more progress wins
        const existingAssignment = this.registry.getByAgent(existingAgent);
        const conflictingAssignment = this.registry.getByAgent(conflictingAgent);

        const existingProgress = this.calculateProgress(existingAssignment);
        const conflictingProgress = this.calculateProgress(conflictingAssignment);

        if (existingProgress >= conflictingProgress) {
          action = "keep_existing";
          keptAgent = existingAgent;
          terminatedAgent = conflictingAgent;
          reason = `equal priority - more progress (${existingProgress.toFixed(2)} vs ${conflictingProgress.toFixed(2)})`;
        } else {
          action = "keep_new";
          keptAgent = conflictingAgent;
          terminatedAgent = existingAgent;
          reason = `equal priority - more progress (${conflictingProgress.toFixed(2)} vs ${existingProgress.toFixed(2)})`;
        }
      }
    }

    // Execute resolution: terminate lower priority agent if applicable
    if (terminatedAgent) {
      await this.terminateAgent(terminatedAgent, conflict.storyId);
    }

    // Publish resolution event
    await this.publishResolutionEvent(conflict, action, keptAgent, terminatedAgent, reason);

    return {
      conflictId,
      action,
      keptAgent,
      terminatedAgent,
      reason,
      resolvedAt: new Date(),
    };
  }

  /**
   * Check if auto-resolution is enabled
   */
  canAutoResolve(): boolean {
    return this.config.autoResolve;
  }

  /**
   * Get the current resolution strategy
   */
  getResolutionStrategy(): ResolutionStrategy {
    return {
      autoResolve: this.config.autoResolve,
      tieBreaker: this.config.tieBreaker,
      notifyOnResolution: this.config.notifyOnResolution ?? false,
    };
  }

  /**
   * Calculate progress score for an agent assignment
   * Used for progress-based tie-breaking
   */
  private calculateProgress(assignment: AgentAssignment | null): number {
    if (!assignment) {
      return 0; // No assignment = no progress
    }

    // Progress based on time spent (simple metric)
    const timeSpent = Date.now() - assignment.assignedAt.getTime();
    const hoursSpent = timeSpent / (1000 * 60 * 60);

    // Normalize to 0-1 range (max progress at 24 hours)
    return Math.min(hoursSpent / 24, 1.0);
  }

  /**
   * Terminate an agent session gracefully
   */
  private async terminateAgent(agentId: string, _storyId: string): Promise<void> {
    try {
      // Create a RuntimeHandle from the agent ID
      const handle: RuntimeHandle = {
        id: agentId,
        runtimeName: this.runtime.name,
        data: {},
      };

      // Destroy the runtime session
      await this.runtime.destroy(handle);

      // Remove from registry
      this.registry.remove(agentId);
    } catch (error) {
      // Log error but don't fail resolution
      // eslint-disable-next-line no-console
      console.error(`Failed to terminate agent ${agentId}:`, error);
    }
  }

  /**
   * Publish conflict resolution event
   */
  private async publishResolutionEvent(
    conflict: AgentConflict,
    action: ResolutionResult["action"],
    keptAgent: string | null,
    terminatedAgent: string | null,
    reason: string,
  ): Promise<void> {
    if (!this.config.eventPublisher) {
      return; // No event publisher configured
    }

    try {
      await this.config.eventPublisher.publish({
        type: "conflict.resolved",
        timestamp: new Date(),
        data: {
          conflictId: conflict.conflictId,
          storyId: conflict.storyId,
          action,
          keptAgent,
          terminatedAgent,
          reason,
          severity: conflict.severity,
        },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to publish resolution event:", error);
    }
  }
}

/**
 * Factory function to create a Conflict Resolution service
 */
export function createConflictResolutionService(
  registry: AgentRegistry,
  runtime: Runtime,
  config?: Partial<ConflictResolutionConfig>,
): ConflictResolutionService {
  return new ConflictResolutionServiceImpl(registry, runtime, config);
}
