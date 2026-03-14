import { describe, expect, it } from "vitest";

import { computePhaseStates } from "../compute-state.js";
import type { Phase, PhaseState } from "../types.js";

type StatesTuple = [PhaseState, PhaseState, PhaseState, PhaseState];

function makePresence(a: boolean, p: boolean, s: boolean, i: boolean): Record<Phase, boolean> {
  return { analysis: a, planning: p, solutioning: s, implementation: i };
}

function toStates(result: ReturnType<typeof computePhaseStates>): StatesTuple {
  return result.map((r) => r.state) as StatesTuple;
}

/**
 * Compute the expected states from a presence map using the downstream
 * inference algorithm. This mirrors the implementation logic for
 * independent verification.
 */
function expectedStates(a: boolean, p: boolean, s: boolean, i: boolean): StatesTuple {
  const phases = [a, p, s, i];
  let lastActive = -1;
  for (let idx = 3; idx >= 0; idx--) {
    if (phases[idx]) {
      lastActive = idx;
      break;
    }
  }
  if (lastActive === -1) return ["not-started", "not-started", "not-started", "not-started"];
  return phases.map((_, idx) => {
    if (idx < lastActive) return "done";
    if (idx === lastActive) return "active";
    return "not-started";
  }) as StatesTuple;
}

describe("computePhaseStates", () => {
  it("returns all not-started when no artifacts exist", () => {
    const result = computePhaseStates(makePresence(false, false, false, false));
    expect(toStates(result)).toEqual(["not-started", "not-started", "not-started", "not-started"]);
  });

  it("returns analysis active when only analysis has artifacts", () => {
    const result = computePhaseStates(makePresence(true, false, false, false));
    expect(toStates(result)).toEqual(["active", "not-started", "not-started", "not-started"]);
  });

  it("returns planning active with analysis done", () => {
    const result = computePhaseStates(makePresence(true, true, false, false));
    expect(toStates(result)).toEqual(["done", "active", "not-started", "not-started"]);
  });

  it("returns solutioning active with earlier phases done", () => {
    const result = computePhaseStates(makePresence(true, true, true, false));
    expect(toStates(result)).toEqual(["done", "done", "active", "not-started"]);
  });

  it("returns implementation active — never done", () => {
    const result = computePhaseStates(makePresence(true, true, true, true));
    expect(toStates(result)).toEqual(["done", "done", "done", "active"]);
  });

  it("applies downstream inference for gaps (solutioning only)", () => {
    const result = computePhaseStates(makePresence(false, false, true, false));
    expect(toStates(result)).toEqual(["done", "done", "active", "not-started"]);
  });

  it("applies downstream inference for gap in analysis (planning only)", () => {
    const result = computePhaseStates(makePresence(false, true, false, false));
    expect(toStates(result)).toEqual(["done", "active", "not-started", "not-started"]);
  });

  it("applies downstream inference for complete gap (implementation only)", () => {
    const result = computePhaseStates(makePresence(false, false, false, true));
    expect(toStates(result)).toEqual(["done", "done", "done", "active"]);
  });

  it("applies downstream inference with gap in planning", () => {
    const result = computePhaseStates(makePresence(true, false, true, false));
    expect(toStates(result)).toEqual(["done", "done", "active", "not-started"]);
  });

  it("returns correct labels for each phase", () => {
    const result = computePhaseStates(makePresence(true, true, true, true));
    expect(result.map((r) => r.label)).toEqual([
      "Analysis",
      "Planning",
      "Solutioning",
      "Implementation",
    ]);
  });

  it("returns correct ids for each phase", () => {
    const result = computePhaseStates(makePresence(false, false, false, false));
    expect(result.map((r) => r.id)).toEqual([
      "analysis",
      "planning",
      "solutioning",
      "implementation",
    ]);
  });

  // Exhaustive: all 16 combinations (2^4)
  describe("all 16 permutations", () => {
    for (let a = 0; a < 2; a++) {
      for (let p = 0; p < 2; p++) {
        for (let s = 0; s < 2; s++) {
          for (let i = 0; i < 2; i++) {
            const label = `[${a},${p},${s},${i}]`;
            it(`permutation ${label}`, () => {
              const presence = makePresence(!!a, !!p, !!s, !!i);
              const result = toStates(computePhaseStates(presence));
              const expected = expectedStates(!!a, !!p, !!s, !!i);
              expect(result).toEqual(expected);
            });
          }
        }
      }
    }
  });
});
