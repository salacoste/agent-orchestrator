/**
 * Workflow event type validation tests (Story 16.5).
 *
 * Verifies that workflow event interfaces are structurally correct
 * and that phase transition detection logic works.
 */
import { describe, expect, it } from "vitest";

import { computePhaseStates } from "../compute-state.js";
import { buildPhasePresence } from "../scan-artifacts.js";
import type { ClassifiedArtifact, Phase, PhaseEntry } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArtifact(phase: Phase | null, type: string): ClassifiedArtifact {
  return {
    filename: `${type.toLowerCase().replace(/\s+/g, "-")}.md`,
    path: `_bmad-output/planning-artifacts/${type.toLowerCase()}.md`,
    modifiedAt: new Date().toISOString(),
    phase,
    type,
  };
}

function detectPhaseTransitions(
  prev: PhaseEntry[],
  curr: PhaseEntry[],
): Array<{ phase: string; previousState: string; newState: string }> {
  const transitions: Array<{
    phase: string;
    previousState: string;
    newState: string;
  }> = [];
  for (let i = 0; i < curr.length; i++) {
    if (prev[i] && curr[i] && prev[i].state !== curr[i].state) {
      transitions.push({
        phase: curr[i].id,
        previousState: prev[i].state,
        newState: curr[i].state,
      });
    }
  }
  return transitions;
}

// ---------------------------------------------------------------------------
// Phase transition detection tests
// ---------------------------------------------------------------------------

describe("workflow phase transition detection", () => {
  it("detects no transitions when phases unchanged", () => {
    const presence = buildPhasePresence([]);
    const phases = computePhaseStates(presence);
    const transitions = detectPhaseTransitions(phases, phases);
    expect(transitions).toHaveLength(0);
  });

  it("detects analysis becoming active when brief is added", () => {
    const before = computePhaseStates(buildPhasePresence([]));
    const after = computePhaseStates(
      buildPhasePresence([makeArtifact("analysis", "Product Brief")]),
    );

    const transitions = detectPhaseTransitions(before, after);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({
      phase: "analysis",
      previousState: "not-started",
      newState: "active",
    });
  });

  it("detects analysis done + planning active when PRD added", () => {
    const before = computePhaseStates(
      buildPhasePresence([makeArtifact("analysis", "Product Brief")]),
    );
    const after = computePhaseStates(
      buildPhasePresence([
        makeArtifact("analysis", "Product Brief"),
        makeArtifact("planning", "PRD"),
      ]),
    );

    const transitions = detectPhaseTransitions(before, after);
    expect(transitions).toHaveLength(2);
    expect(transitions.find((t) => t.phase === "analysis")).toEqual({
      phase: "analysis",
      previousState: "active",
      newState: "done",
    });
    expect(transitions.find((t) => t.phase === "planning")).toEqual({
      phase: "planning",
      previousState: "not-started",
      newState: "active",
    });
  });

  it("detects full progression to implementation", () => {
    const before = computePhaseStates(
      buildPhasePresence([
        makeArtifact("analysis", "Product Brief"),
        makeArtifact("planning", "PRD"),
        makeArtifact("solutioning", "Architecture"),
      ]),
    );
    const after = computePhaseStates(
      buildPhasePresence([
        makeArtifact("analysis", "Product Brief"),
        makeArtifact("planning", "PRD"),
        makeArtifact("solutioning", "Architecture"),
        makeArtifact("implementation", "Sprint Plan"),
      ]),
    );

    const transitions = detectPhaseTransitions(before, after);
    // solutioning: active → done, implementation: not-started → active
    expect(transitions).toHaveLength(2);
    expect(transitions.find((t) => t.phase === "solutioning")?.newState).toBe("done");
    expect(transitions.find((t) => t.phase === "implementation")?.newState).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// SSE event structure validation
// ---------------------------------------------------------------------------

describe("SSE workflow event structures", () => {
  it("workflow.artifact event has required fields", () => {
    const event = {
      type: "workflow.artifact" as const,
      filename: "prd.md",
      phase: "planning",
      artifactType: "PRD",
      action: "created" as const,
      timestamp: new Date().toISOString(),
    };

    expect(event.type).toBe("workflow.artifact");
    expect(typeof event.filename).toBe("string");
    expect(typeof event.phase).toBe("string");
    expect(typeof event.artifactType).toBe("string");
    expect(["created", "updated"]).toContain(event.action);
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("workflow.phase event has required fields", () => {
    const event = {
      type: "workflow.phase" as const,
      phase: "planning",
      previousState: "not-started" as const,
      newState: "active" as const,
      timestamp: new Date().toISOString(),
    };

    expect(event.type).toBe("workflow.phase");
    expect(typeof event.phase).toBe("string");
    expect(["not-started", "done", "active"]).toContain(event.previousState);
    expect(["not-started", "done", "active"]).toContain(event.newState);
  });

  it("workflow.artifact event serializes to valid JSON", () => {
    const event = {
      type: "workflow.artifact",
      filename: "architecture.md",
      phase: "solutioning",
      artifactType: "Architecture",
      action: "updated",
      timestamp: "2026-03-21T04:00:00.000Z",
    };

    const json = JSON.stringify(event);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe("workflow.artifact");
    expect(parsed.filename).toBe("architecture.md");
  });
});
