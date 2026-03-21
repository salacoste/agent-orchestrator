/**
 * Workflow anti-pattern detector (Story 18.4).
 *
 * Evaluates artifact state for known bad workflow patterns and produces
 * coaching nudges. Rules are data-driven, deterministic, and advisory-only.
 */

import type { ClassifiedArtifact, Phase, PhaseEntry } from "./types";

/** A detected anti-pattern with coaching nudge. */
export interface AntiPatternNudge {
  /** Unique pattern identifier for dedup/dismiss tracking. */
  id: string;
  /** Severity level. */
  severity: "info" | "warning";
  /** Short title for the banner. */
  title: string;
  /** Coaching message explaining what to do. */
  message: string;
}

interface AntiPatternRule {
  id: string;
  evaluate: (ctx: AntiPatternContext) => AntiPatternNudge | null;
}

interface AntiPatternContext {
  artifacts: ClassifiedArtifact[];
  phases: PhaseEntry[];
  phasePresence: Record<Phase, boolean>;
}

/**
 * Anti-pattern rules — evaluated sequentially, all matches returned.
 * Unlike recommendations (first-match-wins), ALL matching anti-patterns produce nudges.
 */
const ANTI_PATTERN_RULES: AntiPatternRule[] = [
  {
    id: "skipped-architecture",
    evaluate: (ctx) => {
      // Implementation active but no architecture document
      const implActive = ctx.phases.find((p) => p.id === "implementation" && p.state === "active");
      const hasArch = ctx.artifacts.some((a) => a.type === "Architecture");
      if (implActive && !hasArch) {
        return {
          id: "skipped-architecture",
          severity: "warning",
          title: "Architecture skipped",
          message:
            "Implementation is active but no architecture document was found. " +
            "Consider documenting architecture decisions to maintain consistency.",
        };
      }
      return null;
    },
  },
  {
    id: "no-epics-in-implementation",
    evaluate: (ctx) => {
      const implActive = ctx.phases.find((p) => p.id === "implementation" && p.state === "active");
      const hasEpics = ctx.artifacts.some((a) => a.type === "Epics & Stories");
      if (implActive && !hasEpics) {
        return {
          id: "no-epics-in-implementation",
          severity: "warning",
          title: "No epics defined",
          message:
            "Implementation is underway without documented epics. " +
            "Breaking work into epics and stories improves tracking and reduces scope creep.",
        };
      }
      return null;
    },
  },
  {
    id: "no-brief-with-artifacts",
    evaluate: (ctx) => {
      const hasAny = Object.values(ctx.phasePresence).some(Boolean);
      const hasBrief = ctx.artifacts.some((a) => a.type === "Product Brief");
      if (hasAny && !hasBrief) {
        return {
          id: "no-brief-with-artifacts",
          severity: "info",
          title: "No product brief",
          message:
            "Project has artifacts but no product brief. " +
            "A brief captures vision and constraints — helpful even retroactively.",
        };
      }
      return null;
    },
  },
];

/**
 * Detect anti-patterns in the current workflow state.
 * Returns all matching nudges (unlike recommendations which return first-match only).
 *
 * @param artifacts - Classified artifacts from scanner
 * @param phases - Computed phase states
 * @param phasePresence - Phase presence map
 * @returns Array of coaching nudges (may be empty)
 */
export function detectAntiPatterns(
  artifacts: ClassifiedArtifact[],
  phases: PhaseEntry[],
  phasePresence: Record<Phase, boolean>,
): AntiPatternNudge[] {
  const ctx: AntiPatternContext = { artifacts, phases, phasePresence };
  const nudges: AntiPatternNudge[] = [];

  for (const rule of ANTI_PATTERN_RULES) {
    const nudge = rule.evaluate(ctx);
    if (nudge) nudges.push(nudge);
  }

  return nudges;
}
