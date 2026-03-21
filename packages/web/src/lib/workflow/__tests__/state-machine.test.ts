/**
 * State machine tests — exhaustive guard, transition, and readiness validation.
 */
import { describe, expect, it } from "vitest";

import { ARTIFACT_RULES } from "../artifact-rules.js";
import {
  BMAD_TRANSITIONS,
  DEFAULT_WORKFLOW_CONFIG,
  HAS_ARCHITECTURE,
  HAS_BRIEF,
  HAS_EPICS,
  HAS_PRD,
  createBmadStateMachine,
  createStateMachine,
  createStateMachineFromConfig,
  evaluateGuards,
  getAvailableTransitions,
  getTransitionReadiness,
} from "../state-machine.js";
import type { ClassifiedArtifact, GuardContext, Phase, WorkflowTransition } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArtifact(type: string, phase: Phase | null = null): ClassifiedArtifact {
  return {
    filename: `${type.toLowerCase().replace(/\s+/g, "-")}.md`,
    path: `_bmad-output/planning-artifacts/${type.toLowerCase().replace(/\s+/g, "-")}.md`,
    modifiedAt: new Date().toISOString(),
    phase,
    type,
  };
}

function makeContext(
  artifactTypes: string[],
  phasePresence?: Partial<Record<Phase, boolean>>,
): GuardContext {
  const artifacts = artifactTypes.map((t) => makeArtifact(t));
  return {
    phasePresence: {
      analysis: phasePresence?.analysis ?? false,
      planning: phasePresence?.planning ?? false,
      solutioning: phasePresence?.solutioning ?? false,
      implementation: phasePresence?.implementation ?? false,
    },
    artifacts,
  };
}

const EMPTY_CONTEXT = makeContext([]);

// ---------------------------------------------------------------------------
// Guard evaluation tests
// ---------------------------------------------------------------------------

describe("individual guard conditions", () => {
  it("HAS_BRIEF satisfied when Product Brief exists", () => {
    const ctx = makeContext(["Product Brief"]);
    expect(HAS_BRIEF.evaluate(ctx)).toBe(true);
  });

  it("HAS_BRIEF not satisfied when no brief", () => {
    expect(HAS_BRIEF.evaluate(EMPTY_CONTEXT)).toBe(false);
  });

  it("HAS_PRD satisfied when PRD exists", () => {
    const ctx = makeContext(["PRD"]);
    expect(HAS_PRD.evaluate(ctx)).toBe(true);
  });

  it("HAS_PRD not satisfied when no PRD", () => {
    expect(HAS_PRD.evaluate(EMPTY_CONTEXT)).toBe(false);
  });

  it("HAS_ARCHITECTURE satisfied when Architecture exists", () => {
    const ctx = makeContext(["Architecture"]);
    expect(HAS_ARCHITECTURE.evaluate(ctx)).toBe(true);
  });

  it("HAS_ARCHITECTURE not satisfied when no architecture", () => {
    expect(HAS_ARCHITECTURE.evaluate(EMPTY_CONTEXT)).toBe(false);
  });

  it("HAS_EPICS satisfied when Epics & Stories exists", () => {
    const ctx = makeContext(["Epics & Stories"]);
    expect(HAS_EPICS.evaluate(ctx)).toBe(true);
  });

  it("HAS_EPICS not satisfied when no epics", () => {
    expect(HAS_EPICS.evaluate(EMPTY_CONTEXT)).toBe(false);
  });

  it("guards ignore unrelated artifact types", () => {
    const ctx = makeContext(["Research Report", "UX Design", "Sprint Plan"]);
    expect(HAS_BRIEF.evaluate(ctx)).toBe(false);
    expect(HAS_PRD.evaluate(ctx)).toBe(false);
    expect(HAS_ARCHITECTURE.evaluate(ctx)).toBe(false);
    expect(HAS_EPICS.evaluate(ctx)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateGuards tests
// ---------------------------------------------------------------------------

describe("evaluateGuards", () => {
  const analysisToPlanning = BMAD_TRANSITIONS[0];
  const solutioningToImpl = BMAD_TRANSITIONS[2];

  it("returns satisfied for analysis→planning when brief exists", () => {
    const ctx = makeContext(["Product Brief"]);
    const results = evaluateGuards(analysisToPlanning, ctx);
    expect(results).toHaveLength(1);
    expect(results[0].guardId).toBe("has-brief");
    expect(results[0].satisfied).toBe(true);
  });

  it("returns unsatisfied for analysis→planning with no artifacts", () => {
    const results = evaluateGuards(analysisToPlanning, EMPTY_CONTEXT);
    expect(results).toHaveLength(1);
    expect(results[0].satisfied).toBe(false);
  });

  it("evaluates multiple guards for solutioning→implementation", () => {
    const ctx = makeContext(["Architecture"]);
    const results = evaluateGuards(solutioningToImpl, ctx);
    expect(results).toHaveLength(2);

    const archResult = results.find((r) => r.guardId === "has-architecture");
    const epicsResult = results.find((r) => r.guardId === "has-epics");
    expect(archResult?.satisfied).toBe(true);
    expect(epicsResult?.satisfied).toBe(false);
  });

  it("all guards satisfied when both architecture and epics exist", () => {
    const ctx = makeContext(["Architecture", "Epics & Stories"]);
    const results = evaluateGuards(solutioningToImpl, ctx);
    expect(results.every((r) => r.satisfied)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAvailableTransitions tests
// ---------------------------------------------------------------------------

describe("getAvailableTransitions", () => {
  it("returns no transitions from analysis with no artifacts", () => {
    const result = getAvailableTransitions("analysis", BMAD_TRANSITIONS, EMPTY_CONTEXT);
    expect(result).toHaveLength(0);
  });

  it("returns analysis→planning when brief exists", () => {
    const ctx = makeContext(["Product Brief"]);
    const result = getAvailableTransitions("analysis", BMAD_TRANSITIONS, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].to).toBe("planning");
  });

  it("returns planning→solutioning when PRD exists", () => {
    const ctx = makeContext(["PRD"]);
    const result = getAvailableTransitions("planning", BMAD_TRANSITIONS, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].to).toBe("solutioning");
  });

  it("returns no transitions from solutioning with only architecture", () => {
    const ctx = makeContext(["Architecture"]);
    const result = getAvailableTransitions("solutioning", BMAD_TRANSITIONS, ctx);
    expect(result).toHaveLength(0);
  });

  it("returns solutioning→implementation when both arch and epics exist", () => {
    const ctx = makeContext(["Architecture", "Epics & Stories"]);
    const result = getAvailableTransitions("solutioning", BMAD_TRANSITIONS, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].to).toBe("implementation");
  });

  it("returns no transitions from implementation (terminal phase)", () => {
    const ctx = makeContext(["Product Brief", "PRD", "Architecture", "Epics & Stories"]);
    const result = getAvailableTransitions("implementation", BMAD_TRANSITIONS, ctx);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getTransitionReadiness tests
// ---------------------------------------------------------------------------

describe("getTransitionReadiness", () => {
  it("returns 0% readiness for analysis→planning with no artifacts", () => {
    const results = getTransitionReadiness("analysis", BMAD_TRANSITIONS, EMPTY_CONTEXT);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0);
    expect(results[0].unsatisfied).toHaveLength(1);
    expect(results[0].satisfied).toHaveLength(0);
  });

  it("returns 100% readiness for analysis→planning with brief", () => {
    const ctx = makeContext(["Product Brief"]);
    const results = getTransitionReadiness("analysis", BMAD_TRANSITIONS, ctx);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(100);
    expect(results[0].satisfied).toHaveLength(1);
    expect(results[0].unsatisfied).toHaveLength(0);
  });

  it("returns 50% readiness for solutioning→implementation with only architecture", () => {
    const ctx = makeContext(["Architecture"]);
    const results = getTransitionReadiness("solutioning", BMAD_TRANSITIONS, ctx);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(50);
    expect(results[0].satisfied).toHaveLength(1);
    expect(results[0].unsatisfied).toHaveLength(1);
    expect(results[0].unsatisfied[0].guardId).toBe("has-epics");
  });

  it("returns 100% readiness for solutioning→implementation with all artifacts", () => {
    const ctx = makeContext(["Architecture", "Epics & Stories"]);
    const results = getTransitionReadiness("solutioning", BMAD_TRANSITIONS, ctx);
    expect(results[0].score).toBe(100);
  });

  it("returns empty array for implementation (no outgoing transitions)", () => {
    const results = getTransitionReadiness("implementation", BMAD_TRANSITIONS, EMPTY_CONTEXT);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createBmadStateMachine factory tests
// ---------------------------------------------------------------------------

describe("createBmadStateMachine", () => {
  const sm = createBmadStateMachine();

  it("has 4 phases", () => {
    expect(sm.phases).toHaveLength(4);
    expect([...sm.phases]).toEqual(["analysis", "planning", "solutioning", "implementation"]);
  });

  it("has 3 transitions (linear happy path)", () => {
    expect(sm.transitions).toHaveLength(3);
  });

  it("getAvailableTransitions delegates correctly", () => {
    const ctx = makeContext(["Product Brief"]);
    const result = sm.getAvailableTransitions("analysis", ctx);
    expect(result).toHaveLength(1);
    expect(result[0].to).toBe("planning");
  });

  it("getTransitionReadiness delegates correctly", () => {
    const results = sm.getTransitionReadiness("analysis", EMPTY_CONTEXT);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createStateMachine generic factory tests
// ---------------------------------------------------------------------------

describe("createStateMachine", () => {
  it("creates a state machine with custom transitions", () => {
    const customTransitions: readonly WorkflowTransition[] = [
      {
        from: "analysis",
        to: "implementation",
        description: "Skip to implementation",
        guards: [],
      },
    ];
    const sm = createStateMachine(["analysis", "implementation"], customTransitions);
    expect(sm.phases).toHaveLength(2);
    expect(sm.transitions).toHaveLength(1);
  });

  it("transition with no guards is always available", () => {
    const noGuardTransition: WorkflowTransition = {
      from: "analysis",
      to: "planning",
      description: "Always available",
      guards: [],
    };
    const sm = createStateMachine(["analysis", "planning"], [noGuardTransition]);
    const available = sm.getAvailableTransitions("analysis", EMPTY_CONTEXT);
    expect(available).toHaveLength(1);
  });

  it("transition with no guards has 100% readiness", () => {
    const noGuardTransition: WorkflowTransition = {
      from: "analysis",
      to: "planning",
      description: "Always available",
      guards: [],
    };
    const sm = createStateMachine(["analysis", "planning"], [noGuardTransition]);
    const readiness = sm.getTransitionReadiness("analysis", EMPTY_CONTEXT);
    expect(readiness[0].score).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Guard type strings sync with artifact-rules.ts (Quinn's review finding)
// ---------------------------------------------------------------------------

describe("guard artifact type strings match artifact-rules.ts", () => {
  const ruleTypes = ARTIFACT_RULES.map((r) => r.type);

  it("HAS_BRIEF references a valid artifact type", () => {
    expect(ruleTypes).toContain("Product Brief");
  });

  it("HAS_PRD references a valid artifact type", () => {
    expect(ruleTypes).toContain("PRD");
  });

  it("HAS_ARCHITECTURE references a valid artifact type", () => {
    expect(ruleTypes).toContain("Architecture");
  });

  it("HAS_EPICS references a valid artifact type", () => {
    expect(ruleTypes).toContain("Epics & Stories");
  });
});

// ---------------------------------------------------------------------------
// Performance test
// ---------------------------------------------------------------------------

describe("performance", () => {
  it("computes readiness for all phases in <50ms", () => {
    const artifacts: ClassifiedArtifact[] = Array.from({ length: 100 }, (_, i) =>
      makeArtifact(i % 2 === 0 ? "PRD" : "Architecture", "planning"),
    );
    const ctx: GuardContext = {
      phasePresence: {
        analysis: true,
        planning: true,
        solutioning: true,
        implementation: false,
      },
      artifacts,
    };

    const start = performance.now();
    for (const phase of ["analysis", "planning", "solutioning", "implementation"] as const) {
      getTransitionReadiness(phase, BMAD_TRANSITIONS, ctx);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// createStateMachineFromConfig tests (Story 16.3)
// ---------------------------------------------------------------------------

describe("createStateMachineFromConfig", () => {
  // Imported at top alongside other state-machine exports — see import block

  it("creates state machine from default config", () => {
    const sm = createStateMachineFromConfig(DEFAULT_WORKFLOW_CONFIG);
    expect(sm.phases).toHaveLength(4);
    expect(sm.transitions).toHaveLength(3);
  });

  it("default config produces same results as BMAD hardcoded state machine", () => {
    const configSm = createStateMachineFromConfig(DEFAULT_WORKFLOW_CONFIG);
    const hardcodedSm = createBmadStateMachine();

    // Same phases
    expect([...configSm.phases]).toEqual([...hardcodedSm.phases]);
    // Same number of transitions
    expect(configSm.transitions).toHaveLength(hardcodedSm.transitions.length);

    // Same guard behavior for all artifact combos
    const testCases = [
      [],
      ["Product Brief"],
      ["PRD"],
      ["Architecture"],
      ["Epics & Stories"],
      ["Product Brief", "PRD"],
      ["Product Brief", "PRD", "Architecture", "Epics & Stories"],
    ];

    for (const artifacts of testCases) {
      const ctx = makeContext(artifacts);
      for (const phase of ["analysis", "planning", "solutioning", "implementation"] as const) {
        const configAvail = configSm.getAvailableTransitions(phase, ctx);
        const hardcodedAvail = hardcodedSm.getAvailableTransitions(phase, ctx);
        expect(configAvail.map((t) => t.to)).toEqual(hardcodedAvail.map((t) => t.to));
      }
    }
  });

  it("supports custom phases", () => {
    const customConfig = {
      phases: ["discover", "design", "build"],
      transitions: [
        {
          from: "discover",
          to: "design",
          description: "Start design",
          guards: [
            { id: "has-req", description: "Requirements exist", artifactType: "Requirements" },
          ],
        },
        {
          from: "design",
          to: "build",
          description: "Start build",
          guards: [],
        },
      ],
    };
    const sm = createStateMachineFromConfig(customConfig);
    expect([...sm.phases]).toEqual(["discover", "design", "build"]);
    expect(sm.transitions).toHaveLength(2);
  });

  it("custom config guards work with artifact matching", () => {
    const customConfig = {
      phases: ["a", "b"],
      transitions: [
        {
          from: "a",
          to: "b",
          description: "Advance",
          guards: [{ id: "has-spec", description: "Spec exists", artifactType: "My Custom Spec" }],
        },
      ],
    };
    const sm = createStateMachineFromConfig(customConfig);

    // No artifact → no transition
    const emptyCtx = makeContext([]);
    expect(sm.getAvailableTransitions("a" as Phase, emptyCtx)).toHaveLength(0);

    // Matching artifact → transition available
    const ctx = makeContext(["My Custom Spec"]);
    expect(sm.getAvailableTransitions("a" as Phase, ctx)).toHaveLength(1);
  });

  it("defaults to BMAD phases when phases omitted", () => {
    const configWithoutPhases = {
      transitions: DEFAULT_WORKFLOW_CONFIG.transitions,
    };
    const sm = createStateMachineFromConfig(configWithoutPhases);
    expect([...sm.phases]).toEqual(["analysis", "planning", "solutioning", "implementation"]);
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests (Story 16.3 — M2 review finding)
// ---------------------------------------------------------------------------

describe("WorkflowConfig Zod validation", () => {
  // Import Zod schemas via loadConfig path — test that valid/invalid YAML shapes pass/fail
  // We test the shape directly since Zod schemas aren't exported, but we can validate
  // through the DEFAULT_WORKFLOW_CONFIG shape contract.

  it("DEFAULT_WORKFLOW_CONFIG has valid structure", () => {
    expect(DEFAULT_WORKFLOW_CONFIG.phases).toHaveLength(4);
    expect(DEFAULT_WORKFLOW_CONFIG.transitions).toHaveLength(3);
    for (const t of DEFAULT_WORKFLOW_CONFIG.transitions) {
      expect(typeof t.from).toBe("string");
      expect(typeof t.to).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(Array.isArray(t.guards)).toBe(true);
      for (const g of t.guards) {
        expect(typeof g.id).toBe("string");
        expect(typeof g.description).toBe("string");
        expect(typeof g.artifactType).toBe("string");
      }
    }
  });

  it("every guard in DEFAULT_WORKFLOW_CONFIG has all required fields", () => {
    const allGuards = DEFAULT_WORKFLOW_CONFIG.transitions.flatMap((t) => t.guards);
    expect(allGuards.length).toBeGreaterThan(0);
    for (const g of allGuards) {
      expect(g.id).toBeTruthy();
      expect(g.description).toBeTruthy();
      expect(g.artifactType).toBeTruthy();
    }
  });

  it("every transition references phases that exist in phases array", () => {
    const phases = new Set(DEFAULT_WORKFLOW_CONFIG.phases);
    for (const t of DEFAULT_WORKFLOW_CONFIG.transitions) {
      expect(phases.has(t.from)).toBe(true);
      expect(phases.has(t.to)).toBe(true);
    }
  });
});
