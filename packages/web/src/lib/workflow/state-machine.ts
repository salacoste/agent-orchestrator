/**
 * BMAD Workflow State Machine — pure model with no side effects.
 *
 * Defines phases, transitions, and guard conditions for the BMAD
 * development methodology. All functions are pure: input → output,
 * no I/O, no mutations, fully deterministic and testable.
 *
 * The default BMAD workflow follows:
 *   analysis → planning → solutioning → implementation
 *
 * Each transition has guard conditions that check artifact presence.
 * Story 16.3 will add YAML-configurable workflows via factory pattern.
 */

import type { WorkflowConfig } from "@composio/ao-core";

import {
  PHASES,
  type GuardContext,
  type GuardResult,
  type Phase,
  type TransitionGuard,
  type TransitionReadiness,
  type WorkflowStateMachine,
  type WorkflowTransition,
} from "./types";

// ---------------------------------------------------------------------------
// Guard condition factories — pure functions checking artifact presence
// ---------------------------------------------------------------------------

/**
 * Create a guard that checks whether any artifact matches the given type string.
 * Type strings must match values from artifact-rules.ts (e.g., "Product Brief", "PRD").
 */
export function artifactTypeGuard(
  id: string,
  description: string,
  artifactType: string,
): TransitionGuard {
  return {
    id,
    description,
    evaluate: (ctx: GuardContext): boolean => ctx.artifacts.some((a) => a.type === artifactType),
  };
}

// ---------------------------------------------------------------------------
// Concrete guard instances for the default BMAD workflow
// ---------------------------------------------------------------------------

/** Guard: product brief must exist (analysis → planning). */
export const HAS_BRIEF = artifactTypeGuard("has-brief", "Product brief exists", "Product Brief");

/** Guard: PRD must exist (planning → solutioning). */
export const HAS_PRD = artifactTypeGuard("has-prd", "PRD exists", "PRD");

/** Guard: architecture document must exist (solutioning → implementation). */
export const HAS_ARCHITECTURE = artifactTypeGuard(
  "has-architecture",
  "Architecture document exists",
  "Architecture",
);

/** Guard: epics document must exist (solutioning → implementation). */
export const HAS_EPICS = artifactTypeGuard(
  "has-epics",
  "Epics & stories document exists",
  "Epics & Stories",
);

// ---------------------------------------------------------------------------
// Default BMAD transitions (data, not logic)
// ---------------------------------------------------------------------------

/**
 * Standard BMAD workflow transitions.
 * Linear happy path: analysis → planning → solutioning → implementation.
 * Non-linear paths can be added via YAML config in Story 16.3.
 */
export const BMAD_TRANSITIONS: readonly WorkflowTransition[] = [
  {
    from: "analysis",
    to: "planning",
    description: "Begin planning with PRD and UX design",
    guards: [HAS_BRIEF],
  },
  {
    from: "planning",
    to: "solutioning",
    description: "Design architecture and break into epics",
    guards: [HAS_PRD],
  },
  {
    from: "solutioning",
    to: "implementation",
    description: "Start sprint execution with agents",
    guards: [HAS_ARCHITECTURE, HAS_EPICS],
  },
];

// ---------------------------------------------------------------------------
// Pure computation functions
// ---------------------------------------------------------------------------

/**
 * Evaluate all guard conditions for a transition.
 * Returns one GuardResult per guard, indicating whether it is satisfied.
 *
 * @param transition - The transition to evaluate
 * @param context - Current project context (artifacts, phase presence)
 * @returns Array of guard evaluation results
 */
export function evaluateGuards(
  transition: WorkflowTransition,
  context: GuardContext,
): GuardResult[] {
  return transition.guards.map((guard) => ({
    guardId: guard.id,
    description: guard.description,
    satisfied: guard.evaluate(context),
  }));
}

/**
 * Get transitions from a phase where ALL guards are satisfied.
 *
 * @param currentPhase - The phase to find transitions from
 * @param transitions - Available transitions to evaluate
 * @param context - Current project context
 * @returns Transitions where every guard passes
 */
export function getAvailableTransitions(
  currentPhase: Phase,
  transitions: readonly WorkflowTransition[],
  context: GuardContext,
): WorkflowTransition[] {
  return transitions
    .filter((t) => t.from === currentPhase)
    .filter((t) => {
      const results = evaluateGuards(t, context);
      return results.every((r) => r.satisfied);
    });
}

/**
 * Compute readiness info for all transitions from a phase.
 * Includes both ready (100%) and partially-ready transitions.
 *
 * @param currentPhase - The phase to assess transitions from
 * @param transitions - Available transitions to evaluate
 * @param context - Current project context
 * @returns Readiness assessment for each transition from currentPhase
 */
export function getTransitionReadiness(
  currentPhase: Phase,
  transitions: readonly WorkflowTransition[],
  context: GuardContext,
): TransitionReadiness[] {
  return transitions
    .filter((t) => t.from === currentPhase)
    .map((transition) => {
      const results = evaluateGuards(transition, context);
      const satisfied = results.filter((r) => r.satisfied);
      const unsatisfied = results.filter((r) => !r.satisfied);
      const score =
        results.length === 0 ? 100 : Math.round((satisfied.length / results.length) * 100);

      return { transition, score, satisfied, unsatisfied };
    });
}

// ---------------------------------------------------------------------------
// Factory — creates a WorkflowStateMachine from transition data
// ---------------------------------------------------------------------------

/**
 * Create the default BMAD workflow state machine.
 * Uses the standard 4-phase linear workflow with artifact-based guards.
 *
 * Story 16.3 will add: createStateMachineFromConfig(yaml) for custom workflows.
 */
export function createBmadStateMachine(): WorkflowStateMachine {
  return createStateMachine(PHASES, BMAD_TRANSITIONS);
}

/**
 * Create a workflow state machine from phases and transitions.
 * Generic factory — supports any workflow definition.
 *
 * @param phases - Ordered list of workflow phases
 * @param transitions - Transition definitions with guards
 * @returns A pure WorkflowStateMachine instance
 */
export function createStateMachine(
  phases: readonly Phase[],
  transitions: readonly WorkflowTransition[],
): WorkflowStateMachine {
  return {
    phases,
    transitions,
    getAvailableTransitions: (currentPhase, context) =>
      getAvailableTransitions(currentPhase, transitions, context),
    getTransitionReadiness: (currentPhase, context) =>
      getTransitionReadiness(currentPhase, transitions, context),
  };
}

// ---------------------------------------------------------------------------
// YAML config default + factory (Story 16.3)
// ---------------------------------------------------------------------------

/**
 * Default BMAD workflow configuration.
 * Applied when no `workflow:` section exists in agent-orchestrator.yaml.
 * Must produce behavior identical to BMAD_TRANSITIONS + createBmadStateMachine().
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  phases: ["analysis", "planning", "solutioning", "implementation"],
  transitions: [
    {
      from: "analysis",
      to: "planning",
      description: "Begin planning with PRD and UX design",
      guards: [
        { id: "has-brief", description: "Product brief exists", artifactType: "Product Brief" },
      ],
    },
    {
      from: "planning",
      to: "solutioning",
      description: "Design architecture and break into epics",
      guards: [{ id: "has-prd", description: "PRD exists", artifactType: "PRD" }],
    },
    {
      from: "solutioning",
      to: "implementation",
      description: "Start sprint execution with agents",
      guards: [
        {
          id: "has-architecture",
          description: "Architecture document exists",
          artifactType: "Architecture",
        },
        {
          id: "has-epics",
          description: "Epics & stories document exists",
          artifactType: "Epics & Stories",
        },
      ],
    },
  ],
};

/**
 * Create a workflow state machine from YAML configuration.
 *
 * Maps WorkflowGuardDefinition (data) → TransitionGuard (runtime function)
 * by creating artifact-type guards for each guard definition.
 *
 * @param config - Parsed WorkflowConfig from YAML
 * @returns A pure WorkflowStateMachine instance
 */
export function createStateMachineFromConfig(config: WorkflowConfig): WorkflowStateMachine {
  const phases = (config.phases ?? [...PHASES]) as readonly Phase[];

  const transitions: WorkflowTransition[] = config.transitions.map((t) => ({
    from: t.from as Phase,
    to: t.to as Phase,
    description: t.description,
    guards: t.guards.map((g) => artifactTypeGuard(g.id, g.description, g.artifactType)),
  }));

  return createStateMachine(phases, transitions);
}
