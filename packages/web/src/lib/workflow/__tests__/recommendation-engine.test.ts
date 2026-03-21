import { describe, expect, it } from "vitest";

import { getRecommendation, getStateMachineRecommendation } from "../recommendation-engine";
import { createBmadStateMachine } from "../state-machine";
import type { ClassifiedArtifact, Phase, PhaseEntry, PhaseState } from "../types";

function makeArtifact(filename: string, phase: Phase | null): ClassifiedArtifact {
  return {
    filename,
    path: `_bmad-output/planning-artifacts/${filename}`,
    modifiedAt: "2026-03-13T00:00:00.000Z",
    phase,
    type: "Test",
  };
}

function makePhases(states: [PhaseState, PhaseState, PhaseState, PhaseState]): PhaseEntry[] {
  const ids: Phase[] = ["analysis", "planning", "solutioning", "implementation"];
  const labels = ["Analysis", "Planning", "Solutioning", "Implementation"];
  return ids.map((id, i) => ({
    id,
    label: labels[i],
    state: states[i],
  }));
}

function makePresence(a: boolean, p: boolean, s: boolean, i: boolean): Record<Phase, boolean> {
  return { analysis: a, planning: p, solutioning: s, implementation: i };
}

describe("getRecommendation", () => {
  describe("R1: no artifacts at all", () => {
    it("returns tier 1 recommendation for analysis phase", () => {
      const result = getRecommendation(
        [],
        makePhases(["not-started", "not-started", "not-started", "not-started"]),
        makePresence(false, false, false, false),
      );
      expect(result).not.toBeNull();
      expect(result!.tier).toBe(1);
      expect(result!.phase).toBe("analysis");
      expect(result!.observation).toContain("No BMAD artifacts");
      expect(result!.implication).toContain("analysis phase");
    });
  });

  describe("R2: no product brief", () => {
    it("fires when artifacts exist but no brief", () => {
      const artifacts = [makeArtifact("prd-something.md", "planning")];
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(false, true, false, false),
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe("analysis");
      expect(result!.observation).toContain("No product brief");
      expect(result!.implication).toContain("product brief captures");
    });

    it("does not fire when brief exists", () => {
      const artifacts = [makeArtifact("product-brief.md", "analysis")];
      const result = getRecommendation(
        artifacts,
        makePhases(["active", "not-started", "not-started", "not-started"]),
        makePresence(true, false, false, false),
      );
      // R2 should not match, but R3 (no PRD) will
      expect(result!.observation).not.toContain("No product brief");
      expect(result!.observation).toContain("No PRD");
    });
  });

  describe("R3: no PRD", () => {
    it("fires when brief exists but no PRD", () => {
      const artifacts = [makeArtifact("product-brief.md", "analysis")];
      const result = getRecommendation(
        artifacts,
        makePhases(["active", "not-started", "not-started", "not-started"]),
        makePresence(true, false, false, false),
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe("planning");
      expect(result!.observation).toContain("No PRD");
      expect(result!.implication).toContain("PRD translates");
    });
  });

  describe("R4: no architecture", () => {
    it("fires when brief and PRD exist but no architecture", () => {
      const artifacts = [
        makeArtifact("product-brief.md", "analysis"),
        makeArtifact("prd-dashboard.md", "planning"),
      ];
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(true, true, false, false),
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe("solutioning");
      expect(result!.observation).toContain("Architecture spec not found");
      expect(result!.implication).toContain("Architecture decisions");
    });
  });

  describe("R5: no epics", () => {
    it("fires when architecture exists but no epics", () => {
      const artifacts = [
        makeArtifact("product-brief.md", "analysis"),
        makeArtifact("prd-dashboard.md", "planning"),
        makeArtifact("architecture-doc.md", "solutioning"),
      ];
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "done", "active", "not-started"]),
        makePresence(true, true, true, false),
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe("solutioning");
      expect(result!.observation).toContain("No epic or story files found");
      expect(result!.implication).toContain("Epics break");
    });
  });

  describe("R6: implementation active", () => {
    it("fires when all docs exist and implementation is active", () => {
      const artifacts = [
        makeArtifact("product-brief.md", "analysis"),
        makeArtifact("prd-dashboard.md", "planning"),
        makeArtifact("architecture-doc.md", "solutioning"),
        makeArtifact("epics-workflow.md", "solutioning"),
        makeArtifact("sprint-status.md", "implementation"),
      ];
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "done", "done", "active"]),
        makePresence(true, true, true, true),
      );
      expect(result).not.toBeNull();
      expect(result!.tier).toBe(2);
      expect(result!.phase).toBe("implementation");
      expect(result!.observation).toContain("Implementation phase active");
      expect(result!.implication).toContain("Sprint execution");
    });
  });

  describe("R7: no actionable recommendation", () => {
    it("returns null when all docs exist but implementation is not active", () => {
      const artifacts = [
        makeArtifact("product-brief.md", "analysis"),
        makeArtifact("prd-dashboard.md", "planning"),
        makeArtifact("architecture-doc.md", "solutioning"),
        makeArtifact("epics-workflow.md", "solutioning"),
      ];
      // All phases have artifacts but implementation is not-started (not active)
      // R1-R5 all skip because their conditions are met
      // R6 skips because implementation is not active
      // R7 returns null
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "done", "active", "not-started"]),
        makePresence(true, true, true, false),
      );
      expect(result).toBeNull();
    });
  });

  describe("context voice", () => {
    const imperativePattern = /^(Create|Add|Build|Run|Do|Make|Write|Set|Install|Configure)\s/;

    it("R1 uses factual observations, not imperative verbs", () => {
      const result = getRecommendation(
        [],
        makePhases(["not-started", "not-started", "not-started", "not-started"]),
        makePresence(false, false, false, false),
      );
      expect(result).not.toBeNull();
      expect(result!.observation).not.toMatch(imperativePattern);
      expect(result!.implication).not.toMatch(imperativePattern);
    });

    it("R2-R6 use factual observations, not imperative verbs", () => {
      // R2: no brief
      const r2 = getRecommendation(
        [makeArtifact("prd-something.md", "planning")],
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(false, true, false, false),
      );
      expect(r2!.observation).not.toMatch(imperativePattern);
      expect(r2!.implication).not.toMatch(imperativePattern);

      // R3: no PRD
      const r3 = getRecommendation(
        [makeArtifact("product-brief.md", "analysis")],
        makePhases(["active", "not-started", "not-started", "not-started"]),
        makePresence(true, false, false, false),
      );
      expect(r3!.observation).not.toMatch(imperativePattern);
      expect(r3!.implication).not.toMatch(imperativePattern);

      // R4: no architecture
      const r4 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
        ],
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(true, true, false, false),
      );
      expect(r4!.observation).not.toMatch(imperativePattern);
      expect(r4!.implication).not.toMatch(imperativePattern);

      // R5: no epics
      const r5 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
          makeArtifact("architecture-doc.md", "solutioning"),
        ],
        makePhases(["done", "done", "active", "not-started"]),
        makePresence(true, true, true, false),
      );
      expect(r5!.observation).not.toMatch(imperativePattern);
      expect(r5!.implication).not.toMatch(imperativePattern);

      // R6: implementation active
      const r6 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
          makeArtifact("architecture-doc.md", "solutioning"),
          makeArtifact("epics-workflow.md", "solutioning"),
          makeArtifact("sprint-status.md", "implementation"),
        ],
        makePhases(["done", "done", "done", "active"]),
        makePresence(true, true, true, true),
      );
      expect(r6!.observation).not.toMatch(imperativePattern);
      expect(r6!.implication).not.toMatch(imperativePattern);
    });
  });

  describe("gap scenarios", () => {
    it("R4 fires when implementation has artifacts but solutioning is skipped", () => {
      // Downstream inference: implementation present → all earlier phases "done", implementation "active"
      const artifacts = [
        makeArtifact("product-brief.md", "analysis"),
        makeArtifact("prd-dashboard.md", "planning"),
        makeArtifact("sprint-status.md", "implementation"),
      ];
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "done", "done", "active"]),
        makePresence(true, true, false, true),
      );
      // R2 skips (has brief), R3 skips (has PRD), R4 fires (no architecture)
      expect(result).not.toBeNull();
      expect(result!.phase).toBe("solutioning");
      expect(result!.observation).toContain("Architecture spec not found");
    });

    it("returns R1 when only uncategorized artifacts exist (null-phase)", () => {
      const artifacts = [
        makeArtifact("random-notes.md", null),
        makeArtifact("meeting-log.md", null),
      ];
      const result = getRecommendation(
        artifacts,
        makePhases(["not-started", "not-started", "not-started", "not-started"]),
        makePresence(false, false, false, false),
      );
      // R1 fires because phasePresence is all false (null-phase artifacts don't count)
      expect(result).not.toBeNull();
      expect(result!.tier).toBe(1);
      expect(result!.observation).toContain("No BMAD artifacts");
    });
  });

  describe("first-match-wins", () => {
    it("R2 fires before R3/R4/R5 when brief is missing alongside later gaps", () => {
      // No brief, no PRD, no architecture, no epics — R2, R3, R4, R5 all could fire
      // First-match-wins: R2 (no brief) should take priority
      const artifacts = [makeArtifact("random-notes.md", "analysis")];
      const result = getRecommendation(
        artifacts,
        makePhases(["active", "not-started", "not-started", "not-started"]),
        makePresence(true, false, false, false),
      );
      expect(result).not.toBeNull();
      expect(result!.observation).toContain("No product brief");
      // Verify it's R2, not R3/R4/R5
      expect(result!.observation).not.toContain("No PRD");
      expect(result!.observation).not.toContain("Architecture");
      expect(result!.observation).not.toContain("No epic");
    });
  });

  describe("structured output shape", () => {
    it("returns exactly { tier, observation, implication, phase } for non-null results", () => {
      const result = getRecommendation(
        [],
        makePhases(["not-started", "not-started", "not-started", "not-started"]),
        makePresence(false, false, false, false),
      );
      expect(result).not.toBeNull();
      const keys = Object.keys(result!).sort();
      expect(keys).toEqual([
        "blockers",
        "implication",
        "observation",
        "phase",
        "reasoning",
        "tier",
      ]);
      expect(typeof result!.tier).toBe("number");
      expect(typeof result!.observation).toBe("string");
      expect(typeof result!.implication).toBe("string");
      expect(typeof result!.phase).toBe("string");
    });

    it("R1-R3 return tier 1, R4-R6 return tier 2", () => {
      // R1: tier 1
      const r1 = getRecommendation(
        [],
        makePhases(["not-started", "not-started", "not-started", "not-started"]),
        makePresence(false, false, false, false),
      );
      expect(r1!.tier).toBe(1);

      // R2: tier 1
      const r2 = getRecommendation(
        [makeArtifact("prd-something.md", "planning")],
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(false, true, false, false),
      );
      expect(r2!.tier).toBe(1);

      // R3: tier 1
      const r3 = getRecommendation(
        [makeArtifact("product-brief.md", "analysis")],
        makePhases(["active", "not-started", "not-started", "not-started"]),
        makePresence(true, false, false, false),
      );
      expect(r3!.tier).toBe(1);

      // R4: tier 2
      const r4 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
        ],
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(true, true, false, false),
      );
      expect(r4!.tier).toBe(2);

      // R5: tier 2
      const r5 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
          makeArtifact("architecture-doc.md", "solutioning"),
        ],
        makePhases(["done", "done", "active", "not-started"]),
        makePresence(true, true, true, false),
      );
      expect(r5!.tier).toBe(2);

      // R6: tier 2
      const r6 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
          makeArtifact("architecture-doc.md", "solutioning"),
          makeArtifact("epics-workflow.md", "solutioning"),
          makeArtifact("sprint-status.md", "implementation"),
        ],
        makePhases(["done", "done", "done", "active"]),
        makePresence(true, true, true, true),
      );
      expect(r6!.tier).toBe(2);
    });

    it("each rule returns correct phase per WD-3 spec", () => {
      // R1 → analysis, R2 → analysis
      const r1 = getRecommendation(
        [],
        makePhases(["not-started", "not-started", "not-started", "not-started"]),
        makePresence(false, false, false, false),
      );
      expect(r1!.phase).toBe("analysis");

      const r2 = getRecommendation(
        [makeArtifact("prd-something.md", "planning")],
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(false, true, false, false),
      );
      expect(r2!.phase).toBe("analysis");

      // R3 → planning
      const r3 = getRecommendation(
        [makeArtifact("product-brief.md", "analysis")],
        makePhases(["active", "not-started", "not-started", "not-started"]),
        makePresence(true, false, false, false),
      );
      expect(r3!.phase).toBe("planning");

      // R4 → solutioning, R5 → solutioning
      const r4 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
        ],
        makePhases(["done", "active", "not-started", "not-started"]),
        makePresence(true, true, false, false),
      );
      expect(r4!.phase).toBe("solutioning");

      const r5 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
          makeArtifact("architecture-doc.md", "solutioning"),
        ],
        makePhases(["done", "done", "active", "not-started"]),
        makePresence(true, true, true, false),
      );
      expect(r5!.phase).toBe("solutioning");

      // R6 → implementation
      const r6 = getRecommendation(
        [
          makeArtifact("product-brief.md", "analysis"),
          makeArtifact("prd-dashboard.md", "planning"),
          makeArtifact("architecture-doc.md", "solutioning"),
          makeArtifact("epics-workflow.md", "solutioning"),
          makeArtifact("sprint-status.md", "implementation"),
        ],
        makePhases(["done", "done", "done", "active"]),
        makePresence(true, true, true, true),
      );
      expect(r6!.phase).toBe("implementation");
    });
  });

  describe("edge cases", () => {
    it("matches artifact filenames case-insensitively", () => {
      const artifacts = [makeArtifact("Product-BRIEF.md", "analysis")];
      const result = getRecommendation(
        artifacts,
        makePhases(["active", "not-started", "not-started", "not-started"]),
        makePresence(true, false, false, false),
      );
      // hasBrief should be true (case-insensitive match on "brief")
      // R2 skips, R3 fires (no PRD)
      expect(result).not.toBeNull();
      expect(result!.observation).not.toContain("No product brief");
      expect(result!.observation).toContain("No PRD");
    });

    it("R6 does not fire when implementation phase is done (not active)", () => {
      const artifacts = [
        makeArtifact("product-brief.md", "analysis"),
        makeArtifact("prd-dashboard.md", "planning"),
        makeArtifact("architecture-doc.md", "solutioning"),
        makeArtifact("epics-workflow.md", "solutioning"),
        makeArtifact("sprint-status.md", "implementation"),
      ];
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "done", "done", "done"]),
        makePresence(true, true, true, true),
      );
      // R1-R5 skip (all artifacts present), R6 skips (implementation "done" not "active"), R7 returns null
      expect(result).toBeNull();
    });

    it("full pipeline walkthrough: all rules skip to R7 when artifacts present but not active", () => {
      const artifacts = [
        makeArtifact("product-brief.md", "analysis"),
        makeArtifact("prd-dashboard.md", "planning"),
        makeArtifact("architecture-doc.md", "solutioning"),
        makeArtifact("epics-workflow.md", "solutioning"),
      ];
      // All docs present, implementation not-started → R1-R5 skip, R6 skips (not active), R7 returns null
      const result = getRecommendation(
        artifacts,
        makePhases(["done", "done", "done", "not-started"]),
        makePresence(true, true, true, false),
      );
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// State-machine-based recommendation engine (Story 17.3)
// ---------------------------------------------------------------------------

function makeTypedArtifact(
  phase: Phase | null,
  type: string,
  filename?: string,
): ClassifiedArtifact {
  const name = filename ?? `${type.toLowerCase().replace(/\s+/g, "-")}.md`;
  return {
    filename: name,
    path: `_bmad-output/planning-artifacts/${name}`,
    modifiedAt: "2026-03-21T00:00:00.000Z",
    phase,
    type,
  };
}

describe("getStateMachineRecommendation", () => {
  const sm = createBmadStateMachine();

  it("recommends analysis when no artifacts exist", () => {
    const result = getStateMachineRecommendation(
      [],
      makePhases(["not-started", "not-started", "not-started", "not-started"]),
      sm,
    );
    expect(result).not.toBeNull();
    expect(result?.phase).toBe("analysis");
    expect(result?.tier).toBe(1);
    expect(result?.reasoning).toContain("No artifacts");
    expect(result?.blockers).toEqual([]);
  });

  it("recommends planning when brief exists but no PRD", () => {
    const artifacts = [makeTypedArtifact("analysis", "Product Brief", "product-brief.md")];
    const result = getStateMachineRecommendation(
      artifacts,
      makePhases(["active", "not-started", "not-started", "not-started"]),
      sm,
    );
    expect(result).not.toBeNull();
    expect(result?.phase).toBe("planning");
    expect(result?.blockers?.some((b) => b.guardId === "has-brief" && b.satisfied)).toBe(true);
  });

  it("recommends solutioning when PRD exists but no architecture", () => {
    const artifacts = [
      makeTypedArtifact("analysis", "Product Brief", "product-brief.md"),
      makeTypedArtifact("planning", "PRD", "prd.md"),
    ];
    const result = getStateMachineRecommendation(
      artifacts,
      makePhases(["done", "active", "not-started", "not-started"]),
      sm,
    );
    expect(result).not.toBeNull();
    expect(result?.phase).toBe("solutioning");
  });

  it("shows 50% readiness when architecture exists but epics missing", () => {
    const artifacts = [
      makeTypedArtifact("analysis", "Product Brief", "product-brief.md"),
      makeTypedArtifact("planning", "PRD", "prd.md"),
      makeTypedArtifact("solutioning", "Architecture", "architecture.md"),
    ];
    const result = getStateMachineRecommendation(
      artifacts,
      makePhases(["done", "done", "active", "not-started"]),
      sm,
    );
    expect(result).not.toBeNull();
    expect(result?.phase).toBe("implementation");
    expect(result?.reasoning).toContain("50%");
    expect(result?.blockers?.find((b) => b.guardId === "has-epics")?.satisfied).toBe(false);
    expect(result?.blockers?.find((b) => b.guardId === "has-architecture")?.satisfied).toBe(true);
  });

  it("recommends implementation when all solutioning artifacts exist", () => {
    const artifacts = [
      makeTypedArtifact("analysis", "Product Brief", "product-brief.md"),
      makeTypedArtifact("planning", "PRD", "prd.md"),
      makeTypedArtifact("solutioning", "Architecture", "architecture.md"),
      makeTypedArtifact("solutioning", "Epics & Stories", "epics.md"),
    ];
    const result = getStateMachineRecommendation(
      artifacts,
      makePhases(["done", "done", "active", "not-started"]),
      sm,
    );
    expect(result).not.toBeNull();
    expect(result?.phase).toBe("implementation");
    expect(result?.reasoning).toContain("satisfied");
    expect(result?.blockers?.every((b) => b.satisfied)).toBe(true);
  });

  it("returns implementation recommendation when implementation is active", () => {
    const artifacts = [
      makeTypedArtifact("analysis", "Product Brief", "product-brief.md"),
      makeTypedArtifact("planning", "PRD", "prd.md"),
      makeTypedArtifact("solutioning", "Architecture", "architecture.md"),
      makeTypedArtifact("solutioning", "Epics & Stories", "epics.md"),
      makeTypedArtifact("implementation", "Sprint Plan", "sprint-status.yaml"),
    ];
    const result = getStateMachineRecommendation(
      artifacts,
      makePhases(["done", "done", "done", "active"]),
      sm,
    );
    expect(result).not.toBeNull();
    expect(result?.phase).toBe("implementation");
    expect(result?.tier).toBe(2);
  });

  it("is deterministic — same input always produces same output", () => {
    const artifacts = [makeTypedArtifact("analysis", "Product Brief", "product-brief.md")];
    const phases = makePhases(["active", "not-started", "not-started", "not-started"]);

    const r1 = getStateMachineRecommendation(artifacts, phases, sm);
    const r2 = getStateMachineRecommendation(artifacts, phases, sm);
    expect(r1?.phase).toBe(r2?.phase);
    expect(r1?.observation).toBe(r2?.observation);
    expect(r1?.reasoning).toBe(r2?.reasoning);
  });

  it("returns null when all phases are done", () => {
    const result = getStateMachineRecommendation(
      [],
      makePhases(["done", "done", "done", "done"]),
      sm,
    );
    expect(result).toBeNull();
  });

  it("completes in <50ms for 100 artifacts", () => {
    const artifacts: ClassifiedArtifact[] = Array.from({ length: 100 }, (_, i) =>
      makeTypedArtifact(i % 2 === 0 ? "planning" : "solutioning", "Test", `test-${i}.md`),
    );
    const phases = makePhases(["done", "active", "not-started", "not-started"]);

    const start = performance.now();
    getStateMachineRecommendation(artifacts, phases, sm);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
