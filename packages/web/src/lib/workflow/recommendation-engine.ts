/**
 * Recommendation engine — deterministic 7-rule ordered chain (WD-3).
 *
 * Evaluates artifact state and phase progression to produce contextual
 * guidance. Zero LLM dependency. Context voice: factual observations
 * and implications, no imperative verbs.
 *
 * Rules are evaluated sequentially; first match wins.
 */

import type { ClassifiedArtifact, Phase, PhaseEntry, Recommendation } from "./types.js";

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
