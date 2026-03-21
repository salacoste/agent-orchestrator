/**
 * Recommendation engine — deterministic 7-rule ordered chain (WD-3).
 *
 * Evaluates artifact state and phase progression to produce contextual
 * guidance. Zero LLM dependency. Context voice: factual observations
 * and implications, no imperative verbs.
 *
 * Rules are evaluated sequentially; first match wins.
 */

import type {
  ClassifiedArtifact,
  GuardContext,
  Phase,
  PhaseEntry,
  Recommendation,
  WorkflowStateMachine,
} from "./types";

interface RuleContext {
  /** Whether each phase has at least one classified artifact. */
  phasePresence: Record<Phase, boolean>;
  /** Computed phase states from downstream inference. */
  phases: PhaseEntry[];
  /** Whether specific artifact types exist. */
  hasBrief: boolean;
  hasPrd: boolean;
  hasArchitecture: boolean;
  hasEpics: boolean;
}

interface Rule {
  id: string;
  evaluate: (ctx: RuleContext) => Recommendation | null | false;
}

const RULES: Rule[] = [
  {
    id: "R1",
    evaluate: (ctx) => {
      const hasAny = Object.values(ctx.phasePresence).some(Boolean);
      if (hasAny) return false;
      return {
        tier: 1,
        observation: "No BMAD artifacts detected in this project",
        implication: "Starting with analysis phase would establish project foundations",
        phase: "analysis",
      };
    },
  },
  {
    id: "R2",
    evaluate: (ctx) => {
      if (ctx.hasBrief) return false;
      return {
        tier: 1,
        observation: "No product brief found",
        implication: "A product brief captures core project vision and constraints",
        phase: "analysis",
      };
    },
  },
  {
    id: "R3",
    evaluate: (ctx) => {
      if (ctx.hasPrd) return false;
      return {
        tier: 1,
        observation: "Product brief present. No PRD found",
        implication: "A PRD translates the brief into detailed requirements",
        phase: "planning",
      };
    },
  },
  {
    id: "R4",
    evaluate: (ctx) => {
      if (ctx.hasArchitecture) return false;
      return {
        tier: 2,
        observation: "PRD present. Architecture spec not found",
        implication: "Architecture decisions guide consistent implementation",
        phase: "solutioning",
      };
    },
  },
  {
    id: "R5",
    evaluate: (ctx) => {
      if (ctx.hasEpics) return false;
      return {
        tier: 2,
        observation: "Architecture spec present. No epic or story files found",
        implication: "Epics break requirements into implementable stories",
        phase: "solutioning",
      };
    },
  },
  {
    id: "R6",
    evaluate: (ctx) => {
      const implPhase = ctx.phases.find((p) => p.id === "implementation");
      if (!implPhase || implPhase.state !== "active") return false;
      return {
        tier: 2,
        observation: "All solutioning artifacts present. Implementation phase active",
        implication: "Sprint execution is underway",
        phase: "implementation",
      };
    },
  },
  {
    id: "R7",
    evaluate: () => {
      // All phases have artifacts and implementation is active (caught by R6)
      // or all earlier phases are done — no actionable recommendation
      return null;
    },
  },
];

/**
 * Build rule context from classified artifacts and computed phases.
 */
function buildContext(
  artifacts: ClassifiedArtifact[],
  phases: PhaseEntry[],
  phasePresence: Record<Phase, boolean>,
): RuleContext {
  /**
   * Segment-start match: checks that `pattern` appears at the start of a
   * filename segment (delimited by `.`, `-`, `_`, or whitespace).
   * Prevents false positives like "debriefing" matching "brief" while
   * allowing plurals like "epics" to match "epic".
   */
  const hasType = (pattern: string): boolean => {
    const re = new RegExp(`(?:^|[._\\-\\s])${pattern}`, "i");
    return artifacts.some((a) => re.test(a.filename));
  };

  return {
    phasePresence,
    phases,
    hasBrief: hasType("brief"),
    hasPrd: hasType("prd"),
    hasArchitecture: hasType("architecture"),
    hasEpics: hasType("epic"),
  };
}

/**
 * Generate a recommendation based on current artifact state and phase progression.
 *
 * @returns A Recommendation object, or null if no actionable recommendation applies (R7)
 */
export function getRecommendation(
  artifacts: ClassifiedArtifact[],
  phases: PhaseEntry[],
  phasePresence: Record<Phase, boolean>,
): Recommendation | null {
  const ctx = buildContext(artifacts, phases, phasePresence);

  for (const rule of RULES) {
    const result = rule.evaluate(ctx);
    if (result === false) continue; // Rule didn't match
    return result; // null (R7) or Recommendation
  }

  return null;
}

// ---------------------------------------------------------------------------
// State-machine-based recommendation engine (Story 17.3)
// ---------------------------------------------------------------------------

/** Phase → human-readable action descriptions for state-machine recommendations. */
const PHASE_ACTIONS: Record<Phase, { observation: string; implication: string }> = {
  analysis: {
    observation: "No BMAD artifacts detected or product brief missing",
    implication: "A product brief captures core project vision and constraints",
  },
  planning: {
    observation: "Analysis complete. Planning artifacts needed",
    implication: "A PRD translates the brief into detailed requirements",
  },
  solutioning: {
    observation: "Planning complete. Solutioning artifacts needed",
    implication: "Architecture decisions and epics guide consistent implementation",
  },
  implementation: {
    observation: "All solutioning artifacts present. Ready for implementation",
    implication: "Sprint execution can begin with agents",
  },
};

/**
 * Generate a recommendation using the state machine's transition readiness.
 *
 * Algorithm:
 * 1. Find the current active phase from computed phase states
 * 2. Get transition readiness from that phase
 * 3. If any transition has unsatisfied guards → recommend fixing those
 * 4. If all transitions satisfied → recommend advancing to next phase
 * 5. If no active phase (all not-started) → recommend starting analysis
 * 6. If no active phase (all done) → return null
 *
 * @param artifacts - Classified artifacts from scanner
 * @param phases - Computed phase states
 * @param stateMachine - Workflow state machine instance
 * @returns Recommendation with reasoning + blockers, or null
 */
export function getStateMachineRecommendation(
  artifacts: ClassifiedArtifact[],
  phases: PhaseEntry[],
  stateMachine: WorkflowStateMachine,
): Recommendation | null {
  const phasePresence: Record<Phase, boolean> = {
    analysis: false,
    planning: false,
    solutioning: false,
    implementation: false,
  };
  for (const a of artifacts) {
    if (a.phase) phasePresence[a.phase] = true;
  }

  const context: GuardContext = { phasePresence, artifacts };

  // Find active phase
  const activePhase = phases.find((p) => p.state === "active");

  // All not-started → suggest starting analysis
  if (!activePhase) {
    const allNotStarted = phases.every((p) => p.state === "not-started");
    if (allNotStarted) {
      return {
        tier: 1,
        phase: "analysis",
        observation: "No BMAD artifacts detected in this project",
        implication: "Starting with analysis phase would establish project foundations",
        reasoning: "No artifacts found in any BMAD phase",
        blockers: [],
      };
    }
    // All done or no clear active → no recommendation
    return null;
  }

  // Get readiness for transitions FROM active phase
  const readiness = stateMachine.getTransitionReadiness(activePhase.id, context);

  if (readiness.length === 0) {
    // Terminal phase (implementation) with no outgoing transitions
    if (activePhase.id === "implementation") {
      return {
        tier: 2,
        phase: "implementation",
        observation: "All solutioning artifacts present. Implementation phase active",
        implication: "Sprint execution is underway",
        reasoning: "Implementation is the final phase — no further transitions",
        blockers: [],
      };
    }
    return null;
  }

  // Find first transition with unsatisfied guards (most actionable)
  const firstPartial = readiness.find((r) => r.score < 100);
  if (firstPartial) {
    const targetPhase = firstPartial.transition.to;
    const action = PHASE_ACTIONS[targetPhase] ?? PHASE_ACTIONS[activePhase.id];
    const allGuards = [...firstPartial.satisfied, ...firstPartial.unsatisfied];

    return {
      tier: firstPartial.score === 0 ? 1 : 2,
      phase: targetPhase,
      observation: action.observation,
      implication: action.implication,
      reasoning: `Transition to ${targetPhase}: ${firstPartial.score}% ready (${firstPartial.unsatisfied.length} prerequisite${firstPartial.unsatisfied.length !== 1 ? "s" : ""} missing)`,
      blockers: allGuards.map((g) => ({
        guardId: g.guardId,
        description: g.description,
        satisfied: g.satisfied,
      })),
    };
  }

  // All transitions fully ready → suggest advancing
  const firstReady = readiness[0];
  if (firstReady && firstReady.score === 100) {
    const targetPhase = firstReady.transition.to;
    return {
      tier: 2,
      phase: targetPhase,
      observation: `All prerequisites met for ${targetPhase} phase`,
      implication: firstReady.transition.description,
      reasoning: `All ${firstReady.satisfied.length} guard${firstReady.satisfied.length !== 1 ? "s" : ""} satisfied — ready to advance`,
      blockers: firstReady.satisfied.map((g) => ({
        guardId: g.guardId,
        description: g.description,
        satisfied: true,
      })),
    };
  }

  return null;
}
