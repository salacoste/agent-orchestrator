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
  ProjectConflictConfig,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigValidationWarning,
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
  private projectConfigs: Map<string, ProjectConflictConfig> = new Map();

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
      projectOverrides: config?.projectOverrides ?? new Map(),
    };

    // Initialize project configs from config
    if (this.config.projectOverrides) {
      for (const [projectId, projectConfig] of this.config.projectOverrides.entries()) {
        this.projectConfigs.set(projectId, projectConfig);
      }
    }
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
   * Resolve a conflict with project-specific config
   */
  async resolveForProject(conflict: AgentConflict, projectId: string): Promise<ResolutionResult> {
    const projectConfig = this.getProjectConfig(projectId);
    const effectiveConfig = projectConfig
      ? this.mergeWithProjectConfig(this.config, projectConfig)
      : this.config;

    // Temporarily use project config for resolution
    const originalConfig = { ...this.config };
    this.config = effectiveConfig;

    try {
      return await this.resolve(conflict);
    } finally {
      // Restore original config
      this.config = originalConfig;
    }
  }

  /**
   * Check if auto-resolution is enabled for a specific project
   */
  canAutoResolveForProject(projectId: string): boolean {
    const projectConfig = this.getProjectConfig(projectId);
    if (projectConfig?.autoResolve !== undefined) {
      return projectConfig.autoResolve;
    }
    return this.config.autoResolve;
  }

  /**
   * Get resolution strategy for a specific project
   */
  getResolutionStrategyForProject(projectId: string): ResolutionStrategy {
    const projectConfig = this.getProjectConfig(projectId);
    if (!projectConfig) {
      return this.getResolutionStrategy();
    }

    return {
      autoResolve: projectConfig.autoResolve ?? this.config.autoResolve,
      tieBreaker: projectConfig.tieBreaker ?? this.config.tieBreaker,
      notifyOnResolution:
        projectConfig.notifyOnResolution ?? this.config.notifyOnResolution ?? false,
    };
  }

  /**
   * Set project-specific configuration override
   */
  setProjectConfig(config: ProjectConflictConfig): void {
    // Validate before setting
    const validation = this.validateProjectConfig(config);
    if (!validation.valid) {
      throw new Error(
        `Invalid project config: ${validation.errors.map((e) => e.message).join(", ")}`,
      );
    }

    this.projectConfigs.set(config.projectId, config);
  }

  /**
   * Get project-specific configuration
   */
  getProjectConfig(projectId: string): ProjectConflictConfig | undefined {
    return this.projectConfigs.get(projectId);
  }

  /**
   * Remove project-specific configuration
   */
  removeProjectConfig(projectId: string): void {
    this.projectConfigs.delete(projectId);
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ConflictResolutionConfig): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Validate autoResolve
    if (typeof config.autoResolve !== "boolean") {
      errors.push({
        field: "autoResolve",
        message: "autoResolve must be a boolean",
        severity: "error",
      });
    }

    // Validate tieBreaker
    const validTieBreakers: ResolutionStrategy["tieBreaker"][] = ["recent", "progress"];
    if (!validTieBreakers.includes(config.tieBreaker)) {
      errors.push({
        field: "tieBreaker",
        message: `tieBreaker must be one of: ${validTieBreakers.join(", ")}`,
        severity: "error",
      });
    }

    // Validate project overrides
    if (config.projectOverrides) {
      for (const [projectId, projectConfig] of config.projectOverrides.entries()) {
        const projectValidation = this.validateProjectConfig(projectConfig);
        if (!projectValidation.valid) {
          errors.push({
            field: `projectOverrides.${projectId}`,
            message: projectValidation.errors.map((e) => e.message).join("; "),
            severity: "error",
          });
        }
      }
    }

    // Add warnings for potential issues
    if (config.autoResolve && config.tieBreaker === "recent") {
      warnings.push({
        field: "tieBreaker",
        message: "Using 'recent' tie-breaker with autoResolve may cause agent thrashing",
        suggestion: "Consider using 'progress' tie-breaker to prefer agents with more work done",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate project-specific configuration
   */
  private validateProjectConfig(config: ProjectConflictConfig): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // Validate projectId
    if (!config.projectId || typeof config.projectId !== "string") {
      errors.push({
        field: "projectId",
        message: "projectId is required and must be a string",
        severity: "error",
      });
    }

    // Validate autoResolve if provided
    if (config.autoResolve !== undefined && typeof config.autoResolve !== "boolean") {
      errors.push({
        field: "autoResolve",
        message: "autoResolve must be a boolean",
        severity: "error",
      });
    }

    // Validate tieBreaker if provided
    if (config.tieBreaker !== undefined) {
      const validTieBreakers: ResolutionStrategy["tieBreaker"][] = ["recent", "progress"];
      if (!validTieBreakers.includes(config.tieBreaker)) {
        errors.push({
          field: "tieBreaker",
          message: `tieBreaker must be one of: ${validTieBreakers.join(", ")}`,
          severity: "error",
        });
      }
    }

    // Validate priority weights if provided
    if (config.priorityWeights) {
      for (const [key, value] of Object.entries(config.priorityWeights)) {
        if (typeof value !== "number" || value < 0 || value > 1) {
          errors.push({
            field: `priorityWeights.${key}`,
            message: "Priority weights must be numbers between 0 and 1",
            severity: "error",
          });
        }
      }
    }

    // Add warnings for conflicting settings
    if (config.enabled === false && config.autoResolve === true) {
      warnings.push({
        field: "enabled",
        message: "Conflict resolution is disabled but autoResolve is true",
        suggestion: "Set enabled: true or autoResolve: false",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Merge base config with project-specific overrides
   */
  private mergeWithProjectConfig(
    baseConfig: ConflictResolutionConfig,
    projectConfig: ProjectConflictConfig,
  ): ConflictResolutionConfig {
    return {
      ...baseConfig,
      autoResolve: projectConfig.autoResolve ?? baseConfig.autoResolve,
      tieBreaker: projectConfig.tieBreaker ?? baseConfig.tieBreaker,
      notifyOnResolution: projectConfig.notifyOnResolution ?? baseConfig.notifyOnResolution,
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
