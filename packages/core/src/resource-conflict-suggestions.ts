/**
 * Resource Conflict Resolution Suggestions — types, suggestion generation, impact estimation (Epic 52, Story 52.3).
 *
 * Pure functions that analyze detected resource conflicts and generate actionable
 * resolution strategies. Each strategy includes a description, impact estimate,
 * and recommended flag based on severity.
 *
 * NFR-P4: Suggestion generation responds within 200ms (pure computation, no I/O).
 * NFR-F4-2: Scales to 50 projects (O(1) per conflict — strategy lookup table).
 */

import type {
  ResourceConflict,
  ResourceConflictType,
  ResourceConflictSeverity,
} from "./resource-conflict.js";
import type { OrchestratorConfig } from "./types.js";
import { randomBytes } from "node:crypto";

// =============================================================================
// TYPES
// =============================================================================

/** Resolution strategy identifiers (mapped from PRD FR-F4-3, FR-F4-5). */
export type ResourceConflictResolutionStrategy =
  | "sequential-scheduling"
  | "resource-isolation"
  | "agent-reassignment"
  | "increase-capacity"
  | "stagger-schedules";

/** An action that can be taken to resolve a conflict. */
export interface SuggestionAction {
  /** Action category. */
  type: "config-change" | "agent-operation" | "schedule-change";
  /** Human-readable description of the action. */
  description: string;
}

/** A single resolution suggestion for a conflict. */
export interface ResourceConflictSuggestion {
  /** Unique suggestion ID. */
  id: string;
  /** The conflict this suggestion addresses. */
  conflictId: string;
  /** Strategy type. */
  strategy: ResourceConflictResolutionStrategy;
  /** Human-readable description of what this strategy does. */
  description: string;
  /** Estimated impact of applying this strategy. */
  impactEstimate: string;
  /** Whether this is the recommended strategy for the conflict. */
  recommended: boolean;
  /** Concrete actions to apply this strategy. */
  actions: SuggestionAction[];
}

/** API response for conflict resolution suggestions. */
export interface ConflictResolutionResponse {
  /** The conflict being analyzed. */
  conflict: ResourceConflict;
  /** Generated suggestions, sorted by relevance. */
  suggestions: ResourceConflictSuggestion[];
  /** ISO timestamp when suggestions were generated. */
  generatedAt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Strategies applicable per resource type. */
const STRATEGY_MAP: Record<ResourceConflictType, ResourceConflictResolutionStrategy[]> = {
  repository: ["sequential-scheduling", "resource-isolation", "stagger-schedules"],
  agent: ["agent-reassignment", "increase-capacity", "stagger-schedules"],
  "file-path": ["sequential-scheduling", "resource-isolation"],
  "external-service": ["stagger-schedules", "increase-capacity"],
};

/** Strategy descriptions by resource type. */
const STRATEGY_DESCRIPTIONS: Record<
  ResourceConflictResolutionStrategy,
  Record<ResourceConflictType, string>
> = {
  "sequential-scheduling": {
    repository: "Queue project work sequentially — one project at a time accesses the repository",
    agent: "Queue agent tasks sequentially to prevent concurrent access conflicts",
    "file-path": "Schedule file access sequentially to prevent write collisions",
    "external-service": "Queue API calls sequentially to avoid rate limit conflicts",
  },
  "resource-isolation": {
    repository: "Assign dedicated repository branch to each competing project",
    agent: "Dedicate separate agent instances to each competing project",
    "file-path": "Configure separate worktree paths for each competing project",
    "external-service": "Provision separate service instances per project",
  },
  "agent-reassignment": {
    repository: "Reassign agent from lower-priority project to resolve repo conflict",
    agent: "Reassign agent to a dedicated pool to eliminate sharing conflict",
    "file-path": "Reassign agent to work on non-conflicting file paths",
    "external-service": "Reassign agent to avoid concurrent service access",
  },
  "increase-capacity": {
    repository: "Increase repository access capacity with parallel clone strategies",
    agent: "Add more agents to the shared pool — eliminates current bottleneck",
    "file-path": "Expand workspace to support parallel file access",
    "external-service": "Increase API rate limit capacity or add service quota",
  },
  "stagger-schedules": {
    repository: "Offset repository access schedules to reduce overlap windows",
    agent: "Stagger agent schedules so they don't compete simultaneously",
    "file-path": "Stagger file access schedules to minimize collision risk",
    "external-service": "Offset API call schedules to stay within rate limits",
  },
};

/** Recommended strategy based on severity. */
const RECOMMENDED_BY_SEVERITY: Record<
  ResourceConflictSeverity,
  ResourceConflictResolutionStrategy | null
> = {
  critical: "resource-isolation",
  high: "sequential-scheduling",
  medium: "stagger-schedules",
  low: null, // No action needed for low severity
};

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a unique suggestion ID.
 * Format: `suggestion-<timestamp-base36>-<random-hex>` (follows generateConflictId pattern).
 */
export function generateSuggestionId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString("hex").padStart(8, "0");
  return `suggestion-${timestamp}-${random}`;
}

// =============================================================================
// IMPACT ESTIMATION
// =============================================================================

/**
 * Compute a human-readable impact estimate for a strategy applied to a conflict.
 * Uses heuristics based on strategy type and competing project count.
 */
export function computeImpactEstimate(
  conflict: ResourceConflict,
  strategy: ResourceConflictResolutionStrategy,
): string {
  const count = conflict.competingProjects.length;

  switch (strategy) {
    case "sequential-scheduling":
      return `Delays lower-priority project by ~${count} work cycles`;
    case "resource-isolation":
      return "Eliminates conflict — each project gets dedicated resource";
    case "agent-reassignment": {
      const projects = conflict.competingProjects;
      if (projects.length >= 2) {
        return `Reassigns agent from ${projects[0]} to resolve conflict with ${projects.slice(1).join(", ")}`;
      }
      return "Reassigns agent to resolve sharing conflict";
    }
    case "increase-capacity":
      return `Adds ${count} more capacity — eliminates current bottleneck`;
    case "stagger-schedules": {
      const overlapPercent = Math.max(10, 80 - count * 20);
      return `Offsets schedules by ~${count * 15} minutes — reduces overlap by ~${overlapPercent}%`;
    }
  }
}

// =============================================================================
// SUGGESTION GENERATION
// =============================================================================

/**
 * Generate resolution suggestions for a resource conflict.
 *
 * Pure sync function — no I/O. Maps conflict resource type to applicable strategies,
 * computes impact estimates, and selects recommended strategy based on severity.
 *
 * @param conflict - The detected resource conflict
 * @param config - Optional orchestrator config for agent-specific suggestions
 * @returns Array of resolution suggestions (may be empty for low-severity or unknown types)
 */
export function generateSuggestions(
  conflict: ResourceConflict,
  config?: OrchestratorConfig,
): ResourceConflictSuggestion[] {
  const strategies = STRATEGY_MAP[conflict.resourceType];

  // Unknown resource type — no suggestions
  if (!strategies) return [];

  // Low severity — informational only, no action needed
  if (conflict.severity === "low") return [];

  const recommendedStrategy = RECOMMENDED_BY_SEVERITY[conflict.severity];
  const suggestions: ResourceConflictSuggestion[] = [];

  for (const strategy of strategies) {
    const isRecommended = strategy === recommendedStrategy;

    // For agent-reassignment, check if shared pool exists
    if (strategy === "agent-reassignment" && config?.projects) {
      const hasPool = conflict.competingProjects.some((pId) => {
        const proj = config.projects[pId];
        return proj?.sharedPool?.enabled === true;
      });
      if (!hasPool && conflict.resourceType === "agent") {
        // Skip agent-reassignment if no shared pool configured
        continue;
      }
    }

    const actions = computeActions(conflict, strategy);

    suggestions.push({
      id: generateSuggestionId(),
      conflictId: conflict.id,
      strategy,
      description: STRATEGY_DESCRIPTIONS[strategy][conflict.resourceType],
      impactEstimate: computeImpactEstimate(conflict, strategy),
      recommended: isRecommended,
      actions,
    });
  }

  // If recommended strategy wasn't in the list, mark first suggestion as recommended
  if (suggestions.length > 0 && !suggestions.some((s) => s.recommended)) {
    suggestions[0].recommended = true;
  }

  return suggestions;
}

/**
 * Compute concrete actions for a strategy applied to a conflict.
 * Actions are tailored to the conflict's resource type and competing projects.
 */
function computeActions(
  conflict: ResourceConflict,
  strategy: ResourceConflictResolutionStrategy,
): SuggestionAction[] {
  const projectList = conflict.competingProjects.join(", ");

  switch (strategy) {
    case "sequential-scheduling":
      return [
        {
          type: "schedule-change",
          description: `Define priority order for: ${projectList}`,
        },
        {
          type: "config-change",
          description: "Configure sequential access scheduling in project config",
        },
      ];
    case "resource-isolation":
      if (conflict.resourceType === "repository") {
        return [
          { type: "config-change", description: "Configure separate branches for each project" },
        ];
      }
      if (conflict.resourceType === "agent") {
        return [
          {
            type: "config-change",
            description: "Dedicate separate agent instances to each competing project",
          },
        ];
      }
      if (conflict.resourceType === "external-service") {
        return [
          {
            type: "config-change",
            description: "Provision separate service instances per project",
          },
        ];
      }
      return [
        {
          type: "config-change",
          description: "Configure separate worktree paths for each project",
        },
      ];
    case "agent-reassignment":
      return [
        {
          type: "agent-operation",
          description: `Reassign agent from shared pool to dedicated project (${projectList})`,
        },
      ];
    case "increase-capacity":
      return [
        {
          type: "config-change",
          description: `Increase maxConcurrent in shared pool config (current conflict: ${projectList})`,
        },
      ];
    case "stagger-schedules":
      return [
        {
          type: "schedule-change",
          description: `Offset start times for: ${projectList}`,
        },
      ];
  }
}

// =============================================================================
// RECOMMENDED STRATEGY SELECTION
// =============================================================================

/**
 * Select the recommended suggestion from a list.
 * Returns the first suggestion marked as recommended, or null.
 */
export function selectRecommendedStrategy(
  suggestions: ResourceConflictSuggestion[],
): ResourceConflictSuggestion | null {
  return suggestions.find((s) => s.recommended) ?? null;
}
