/**
 * Conflict Detection Service
 *
 * Detects and manages conflicts when multiple agents are assigned to the same story.
 * Provides priority-based conflict resolution and CLI command to view conflicts.
 *
 * Features:
 * - Duplicate assignment detection before spawn
 * - Concurrent spawn attempt detection with locking
 * - Priority scoring based on story progress, time spent, agent type
 * - Conflict event publishing for notification
 * - CLI command to list and manage conflicts
 */

import { randomUUID } from "node:crypto";
import type {
  AgentConflict,
  ConflictDetectionService,
  AgentConflictEvent,
  AgentConflictResolution,
  AgentConflictSeverity,
  PriorityScores,
  AgentAssignment,
  AgentRegistry,
} from "./types.js";

const DEFAULT_AUTO_RESOLVE_THRESHOLD = 0.3; // 30% difference threshold

/**
 * In-memory conflict detection implementation
 */
export class ConflictDetectionServiceImpl implements ConflictDetectionService {
  private conflicts: Map<string, AgentConflict>;
  private registry: AgentRegistry;
  private config: {
    enabled: boolean;
    autoResolve?: {
      enabled: boolean;
      threshold?: number;
    };
  };

  constructor(
    registry: AgentRegistry,
    config?: { enabled?: boolean; autoResolve?: { enabled?: boolean; threshold?: number } },
  ) {
    this.conflicts = new Map();
    this.registry = registry;
    this.config = {
      enabled: config?.enabled ?? true,
      autoResolve: {
        enabled: config?.autoResolve?.enabled ?? false,
        threshold: config?.autoResolve?.threshold,
      },
    };
  }

  /**
   * Check if a story can be assigned to an agent without conflict
   * Note: agentId parameter is part of interface contract but not used in this implementation
   */
  canAssign(storyId: string, _agentId: string): boolean {
    if (!this.config.enabled) {
      return true; // Conflict detection disabled
    }

    const existing = this.registry.findActiveByStory(storyId);
    return !existing; // No conflict if no active assignment
  }

  /**
   * Detect conflicts for a potential story assignment
   */
  detectConflict(storyId: string, agentId: string): AgentConflictEvent | null {
    if (!this.config.enabled) {
      return null; // Conflict detection disabled
    }

    const existing = this.registry.findActiveByStory(storyId);
    if (!existing) {
      return null; // No conflict - story is unassigned
    }

    // Create conflict event
    const conflict: AgentConflictEvent = {
      conflictId: randomUUID(),
      storyId,
      existingAgent: existing.agentId,
      conflictingAgent: agentId,
      type: "duplicate-assignment",
      detectedAt: new Date(),
      priorityScores: this.calculatePriorityScores({
        conflictId: randomUUID(),
        storyId,
        existingAgent: existing.agentId,
        conflictingAgent: agentId,
        type: "duplicate-assignment",
        detectedAt: new Date(),
        priorityScores: {},
      }),
    };

    return conflict;
  }

  /**
   * Record a conflict event
   */
  recordConflict(conflict: AgentConflictEvent): void {
    const agentConflict: AgentConflict = {
      ...conflict,
      severity: this.calculateSeverity(conflict),
      recommendations: this.generateRecommendations(conflict),
    };

    this.conflicts.set(agentConflict.conflictId, agentConflict);
  }

  /**
   * Get all active conflicts
   */
  getConflicts(): AgentConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Get conflicts for a specific story
   */
  getConflictsByStory(storyId: string): AgentConflict[] {
    return this.getConflicts().filter((c) => c.storyId === storyId);
  }

  /**
   * Resolve a conflict
   */
  resolveConflict(conflictId: string, resolution: AgentConflictResolution["resolution"]): void {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    // Apply resolution
    conflict.resolution = {
      resolution,
      resolvedAt: new Date(),
    };

    // If resolved, remove from active conflicts
    if (resolution === "keep-existing" || resolution === "replace-with-new") {
      this.conflicts.delete(conflictId);
    }
  }

  /**
   * Calculate priority score for conflict resolution
   * Higher score = higher priority (should keep assignment)
   */
  calculatePriorityScores(conflict: AgentConflictEvent): PriorityScores {
    const scores: PriorityScores = {};

    // Get assignment details for both agents
    const existingAssignment = this.registry.getByAgent(conflict.existingAgent);
    const conflictingAgentId = conflict.conflictingAgent;

    // Score existing agent
    if (existingAssignment) {
      scores[conflict.existingAgent] = this.calculateAgentPriority(existingAssignment);
    }

    // Score conflicting agent (no assignment history, so base score)
    scores[conflictingAgentId] = this.calculateAgentPriority(null);

    return scores;
  }

  /**
   * Calculate priority score for an agent assignment
   */
  private calculateAgentPriority(assignment: AgentAssignment | null): number {
    if (!assignment) {
      return 0.3; // Base priority for new agents
    }

    let score = 0.5; // Base score

    // Factor 1: Time spent on story (longer = higher priority)
    const timeSpent = Date.now() - assignment.assignedAt.getTime();
    const hoursSpent = timeSpent / (1000 * 60 * 60);
    score += Math.min(hoursSpent / 24, 0.3); // Max +0.3 for 24+ hours

    // Factor 2: Agent type weighting (CLI vs agent)
    if (assignment.agentId.startsWith("ao-story-")) {
      score += 0.1; // Story agent bonus
    }
    if (assignment.agentId.includes("cli")) {
      score += 0.05; // CLI agent bonus
    }

    // Factor 3: Retry count (more retries = lower priority)
    const retryCount = this.registry.getRetryCount(assignment.storyId);
    score -= Math.min(retryCount * 0.05, 0.2); // Max -0.2 penalty

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate severity of a conflict
   */
  private calculateSeverity(conflict: AgentConflictEvent): AgentConflictSeverity {
    const scores = this.calculatePriorityScores(conflict);
    const existingScore = scores[conflict.existingAgent] ?? 0;
    const conflictingScore = scores[conflict.conflictingAgent] ?? 0;

    // Critical: If existing agent has high priority (>0.7)
    if (existingScore > 0.7) {
      return "critical";
    }

    // High: If both have similar priority (within 0.2)
    if (Math.abs(existingScore - conflictingScore) < 0.2) {
      return "high";
    }

    // Medium: If scores differ moderately
    if (Math.abs(existingScore - conflictingScore) < 0.5) {
      return "medium";
    }

    // Low: Clear priority difference
    return "low";
  }

  /**
   * Generate recommendations for conflict resolution
   */
  private generateRecommendations(conflict: AgentConflictEvent): string[] {
    const recommendations: string[] = [];
    const scores = this.calculatePriorityScores(conflict);

    const existingScore = scores[conflict.existingAgent] ?? 0;
    const conflictingScore = scores[conflict.conflictingAgent] ?? 0;

    if (existingScore > conflictingScore + 0.3) {
      recommendations.push(
        `Keep ${conflict.existingAgent} (priority: ${existingScore.toFixed(2)})`,
      );
    } else if (conflictingScore > existingScore + 0.3) {
      recommendations.push(
        `Consider ${conflict.conflictingAgent} (priority: ${conflictingScore.toFixed(2)})`,
      );
    } else {
      recommendations.push("Manual resolution required - priorities are similar");
    }

    // Add specific recommendations based on agent types
    if (conflict.existingAgent.includes("retry")) {
      recommendations.push("Existing agent is a retry attempt - consider replacing");
    }

    return recommendations;
  }

  /**
   * Attempt auto-resolution if enabled
   */
  attemptAutoResolution(conflict: AgentConflictEvent): boolean {
    if (!this.config.autoResolve?.enabled) {
      return false;
    }

    const scores = this.calculatePriorityScores(conflict);
    const threshold = this.config.autoResolve.threshold ?? DEFAULT_AUTO_RESOLVE_THRESHOLD;

    const existingScore = scores[conflict.existingAgent] ?? 0;
    const conflictingScore = scores[conflict.conflictingAgent] ?? 0;
    const scoreDiff = Math.abs(existingScore - conflictingScore);

    if (scoreDiff > threshold) {
      // Clear winner - auto-resolve
      const resolution: AgentConflictResolution["resolution"] =
        existingScore > conflictingScore ? "keep-existing" : "replace-with-new";

      this.resolveConflict(conflict.conflictId, resolution);
      return true;
    }

    return false;
  }
}

/**
 * Factory function to create a ConflictDetection service
 */
export function createConflictDetectionService(
  registry: AgentRegistry,
  config?: { enabled?: boolean; autoResolve?: { enabled?: boolean; threshold?: number } },
): ConflictDetectionService {
  return new ConflictDetectionServiceImpl(registry, config);
}
