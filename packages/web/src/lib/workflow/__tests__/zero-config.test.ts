/**
 * Zero-config integration tests (Story 16.6).
 *
 * Validates the full pipeline: scan → classify → graph → state machine →
 * transitions → readiness → recommendations. All with zero workflow config.
 */
import { describe, expect, it } from "vitest";

import { computePhaseStates } from "../compute-state.js";
import { getRecommendation } from "../recommendation-engine.js";
import { buildPhasePresence } from "../scan-artifacts.js";
import {
  createBmadStateMachine,
  createStateMachineFromConfig,
  DEFAULT_WORKFLOW_CONFIG,
} from "../state-machine.js";
import type { ClassifiedArtifact, GuardContext, Phase } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArtifact(phase: Phase | null, type: string, filename?: string): ClassifiedArtifact {
  const name = filename ?? `${type.toLowerCase().replace(/\s+/g, "-")}.md`;
  return {
    filename: name,
    path: `_bmad-output/planning-artifacts/${name}`,
    modifiedAt: new Date().toISOString(),
    phase,
    type,
  };
}

function buildContext(artifacts: ClassifiedArtifact[]): GuardContext {
  return {
    phasePresence: buildPhasePresence(artifacts),
    artifacts,
  };
}

// ---------------------------------------------------------------------------
// Full pipeline: zero artifacts
// ---------------------------------------------------------------------------

describe("zero-config: no artifacts", () => {
  const sm = createBmadStateMachine();
  const artifacts: ClassifiedArtifact[] = [];
  const ctx = buildContext(artifacts);
  const presence = buildPhasePresence(artifacts);
  const phases = computePhaseStates(presence);

  it("all phases are not-started", () => {
    expect(phases.every((p) => p.state === "not-started")).toBe(true);
  });

  it("no transitions available from analysis", () => {
    expect(sm.getAvailableTransitions("analysis", ctx)).toHaveLength(0);
  });

  it("analysis→planning readiness is 0%", () => {
    const readiness = sm.getTransitionReadiness("analysis", ctx);
    expect(readiness).toHaveLength(1);
    expect(readiness[0].score).toBe(0);
  });

  it("recommendation suggests starting with analysis", () => {
    const rec = getRecommendation(artifacts, phases, presence);
    expect(rec).not.toBeNull();
    expect(rec?.phase).toBe("analysis");
  });
});

// ---------------------------------------------------------------------------
// Full pipeline: PRD + architecture exist
// ---------------------------------------------------------------------------

describe("zero-config: PRD + architecture present", () => {
  const sm = createBmadStateMachine();
  const artifacts = [
    makeArtifact("analysis", "Product Brief", "product-brief.md"),
    makeArtifact("planning", "PRD", "prd.md"),
    makeArtifact("solutioning", "Architecture", "architecture.md"),
  ];
  const ctx = buildContext(artifacts);
  const presence = buildPhasePresence(artifacts);
  const phases = computePhaseStates(presence);

  it("analysis and planning are done, solutioning is active", () => {
    const stateMap = Object.fromEntries(phases.map((p) => [p.id, p.state]));
    expect(stateMap.analysis).toBe("done");
    expect(stateMap.planning).toBe("done");
    expect(stateMap.solutioning).toBe("active");
    expect(stateMap.implementation).toBe("not-started");
  });

  it("solutioning→implementation partially ready (architecture but no epics)", () => {
    const readiness = sm.getTransitionReadiness("solutioning", ctx);
    expect(readiness).toHaveLength(1);
    expect(readiness[0].score).toBe(50);
    expect(readiness[0].unsatisfied[0].guardId).toBe("has-epics");
  });

  it("no available transition from solutioning (epics missing)", () => {
    expect(sm.getAvailableTransitions("solutioning", ctx)).toHaveLength(0);
  });

  it("recommendation suggests creating epics", () => {
    const rec = getRecommendation(artifacts, phases, presence);
    expect(rec).not.toBeNull();
    expect(rec?.phase).toBe("solutioning");
    // The existing recommendation engine should suggest epics
  });
});

// ---------------------------------------------------------------------------
// Full pipeline: all artifacts present
// ---------------------------------------------------------------------------

describe("zero-config: full project with all artifacts", () => {
  const sm = createBmadStateMachine();
  const artifacts = [
    makeArtifact("analysis", "Product Brief", "product-brief.md"),
    makeArtifact("planning", "PRD", "prd.md"),
    makeArtifact("solutioning", "Architecture", "architecture.md"),
    makeArtifact("solutioning", "Epics & Stories", "epics.md"),
    makeArtifact("implementation", "Sprint Plan", "sprint-status.yaml"),
  ];
  const ctx = buildContext(artifacts);
  const presence = buildPhasePresence(artifacts);
  const phases = computePhaseStates(presence);

  it("all phases done except implementation (active)", () => {
    const stateMap = Object.fromEntries(phases.map((p) => [p.id, p.state]));
    expect(stateMap.analysis).toBe("done");
    expect(stateMap.planning).toBe("done");
    expect(stateMap.solutioning).toBe("done");
    expect(stateMap.implementation).toBe("active");
  });

  it("solutioning→implementation is 100% ready", () => {
    const readiness = sm.getTransitionReadiness("solutioning", ctx);
    expect(readiness).toHaveLength(1);
    expect(readiness[0].score).toBe(100);
  });

  it("all transitions fully satisfied", () => {
    expect(sm.getAvailableTransitions("analysis", ctx)).toHaveLength(1);
    expect(sm.getAvailableTransitions("planning", ctx)).toHaveLength(1);
    expect(sm.getAvailableTransitions("solutioning", ctx)).toHaveLength(1);
    // implementation is terminal — no outgoing transitions
    expect(sm.getAvailableTransitions("implementation", ctx)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Config factory produces same results as hardcoded
// ---------------------------------------------------------------------------

describe("zero-config: DEFAULT_WORKFLOW_CONFIG matches hardcoded", () => {
  const configSm = createStateMachineFromConfig(DEFAULT_WORKFLOW_CONFIG);
  const hardcodedSm = createBmadStateMachine();

  it("same phases", () => {
    expect([...configSm.phases]).toEqual([...hardcodedSm.phases]);
  });

  it("same number of transitions", () => {
    expect(configSm.transitions).toHaveLength(hardcodedSm.transitions.length);
  });

  it("same behavior for every artifact combination", () => {
    const combos: ClassifiedArtifact[][] = [
      [],
      [makeArtifact("analysis", "Product Brief")],
      [makeArtifact("analysis", "Product Brief"), makeArtifact("planning", "PRD")],
      [
        makeArtifact("analysis", "Product Brief"),
        makeArtifact("planning", "PRD"),
        makeArtifact("solutioning", "Architecture"),
        makeArtifact("solutioning", "Epics & Stories"),
      ],
    ];

    for (const artifacts of combos) {
      const ctx = buildContext(artifacts);
      for (const phase of ["analysis", "planning", "solutioning", "implementation"] as const) {
        const configResult = configSm.getAvailableTransitions(phase, ctx);
        const hardcodedResult = hardcodedSm.getAvailableTransitions(phase, ctx);
        expect(
          configResult.map((t) => t.to),
          `Mismatch at phase=${phase} with ${artifacts.length} artifacts`,
        ).toEqual(hardcodedResult.map((t) => t.to));
      }
    }
  });
});
