/**
 * Anti-pattern detector tests (Story 18.4).
 */
import { describe, expect, it } from "vitest";

import { detectAntiPatterns } from "../anti-patterns";
import type { ClassifiedArtifact, Phase, PhaseEntry, PhaseState } from "../types";

function makeArtifact(phase: Phase | null, type: string): ClassifiedArtifact {
  return {
    filename: `${type.toLowerCase().replace(/\s+/g, "-")}.md`,
    path: `_bmad-output/${type.toLowerCase()}.md`,
    modifiedAt: new Date().toISOString(),
    phase,
    type,
  };
}

function makePhases(states: [PhaseState, PhaseState, PhaseState, PhaseState]): PhaseEntry[] {
  const ids: Phase[] = ["analysis", "planning", "solutioning", "implementation"];
  return ids.map((id, i) => ({ id, label: id, state: states[i] }));
}

function makePresence(a: boolean, p: boolean, s: boolean, i: boolean): Record<Phase, boolean> {
  return { analysis: a, planning: p, solutioning: s, implementation: i };
}

describe("detectAntiPatterns", () => {
  it("returns empty array when no anti-patterns detected", () => {
    const artifacts = [
      makeArtifact("analysis", "Product Brief"),
      makeArtifact("planning", "PRD"),
      makeArtifact("solutioning", "Architecture"),
      makeArtifact("solutioning", "Epics & Stories"),
    ];
    const phases = makePhases(["done", "done", "done", "active"]);
    const presence = makePresence(true, true, true, true);

    const nudges = detectAntiPatterns(artifacts, phases, presence);
    expect(nudges).toHaveLength(0);
  });

  it("detects skipped architecture when implementation active without architecture", () => {
    const artifacts = [
      makeArtifact("analysis", "Product Brief"),
      makeArtifact("planning", "PRD"),
      makeArtifact("implementation", "Sprint Plan"),
    ];
    const phases = makePhases(["done", "done", "not-started", "active"]);
    const presence = makePresence(true, true, false, true);

    const nudges = detectAntiPatterns(artifacts, phases, presence);
    const arch = nudges.find((n) => n.id === "skipped-architecture");
    expect(arch).toBeDefined();
    expect(arch?.severity).toBe("warning");
  });

  it("detects no epics when implementation active without epics", () => {
    const artifacts = [
      makeArtifact("analysis", "Product Brief"),
      makeArtifact("solutioning", "Architecture"),
      makeArtifact("implementation", "Sprint Plan"),
    ];
    const phases = makePhases(["done", "done", "done", "active"]);
    const presence = makePresence(true, false, true, true);

    const nudges = detectAntiPatterns(artifacts, phases, presence);
    const epics = nudges.find((n) => n.id === "no-epics-in-implementation");
    expect(epics).toBeDefined();
    expect(epics?.severity).toBe("warning");
  });

  it("detects missing brief when artifacts exist but no brief", () => {
    const artifacts = [makeArtifact("planning", "PRD")];
    const phases = makePhases(["not-started", "active", "not-started", "not-started"]);
    const presence = makePresence(false, true, false, false);

    const nudges = detectAntiPatterns(artifacts, phases, presence);
    const brief = nudges.find((n) => n.id === "no-brief-with-artifacts");
    expect(brief).toBeDefined();
    expect(brief?.severity).toBe("info");
  });

  it("returns multiple nudges when multiple anti-patterns match", () => {
    const artifacts = [makeArtifact("implementation", "Sprint Plan")];
    const phases = makePhases(["not-started", "not-started", "not-started", "active"]);
    const presence = makePresence(false, false, false, true);

    const nudges = detectAntiPatterns(artifacts, phases, presence);
    // Should detect: skipped-architecture, no-epics, no-brief
    expect(nudges.length).toBeGreaterThanOrEqual(3);
  });

  it("returns no nudges for empty project", () => {
    const nudges = detectAntiPatterns(
      [],
      makePhases(["not-started", "not-started", "not-started", "not-started"]),
      makePresence(false, false, false, false),
    );
    expect(nudges).toHaveLength(0);
  });

  it("each nudge has required fields", () => {
    const artifacts = [makeArtifact("implementation", "Sprint Plan")];
    const phases = makePhases(["not-started", "not-started", "not-started", "active"]);
    const presence = makePresence(false, false, false, true);

    const nudges = detectAntiPatterns(artifacts, phases, presence);
    for (const nudge of nudges) {
      expect(nudge.id).toBeTruthy();
      expect(nudge.title).toBeTruthy();
      expect(nudge.message).toBeTruthy();
      expect(["info", "warning"]).toContain(nudge.severity);
    }
  });
});
