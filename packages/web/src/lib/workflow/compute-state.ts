/**
 * Phase computation engine — downstream inference algorithm (WD-1).
 *
 * Computes the state of each BMAD phase from artifact presence.
 * Key rules:
 * - Downstream inference: if a later phase has artifacts, earlier phases are "done"
 * - Only ONE phase can be "active" — the latest phase with artifacts
 * - Implementation can never be "done" via artifact detection alone
 * - No artifacts at all → all "not-started"
 */

import { PHASES, PHASE_LABELS, type Phase, type PhaseEntry, type PhaseState } from "./types";

/**
 * Compute phase states from a phase-presence map.
 *
 * @param artifactsByPhase  Record indicating whether each phase has at least one artifact
 * @returns Ordered array of phase entries with computed states
 */
export function computePhaseStates(artifactsByPhase: Record<Phase, boolean>): PhaseEntry[] {
  // Step 1: Find the latest phase that has artifacts (scan right-to-left)
  let lastActiveIndex = -1;
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (artifactsByPhase[PHASES[i]]) {
      lastActiveIndex = i;
      break;
    }
  }

  // Step 2: No artifacts at all → all not-started
  if (lastActiveIndex === -1) {
    return PHASES.map((id) => ({
      id,
      label: PHASE_LABELS[id],
      state: "not-started" as PhaseState,
    }));
  }

  // Step 3: Apply downstream inference
  return PHASES.map((id, index) => {
    let state: PhaseState;
    if (index < lastActiveIndex) {
      state = "done"; // Downstream inference — earlier phases inferred complete
    } else if (index === lastActiveIndex) {
      state = "active"; // Current phase
    } else {
      state = "not-started"; // Future phases
    }
    return { id, label: PHASE_LABELS[id], state };
  });
}
