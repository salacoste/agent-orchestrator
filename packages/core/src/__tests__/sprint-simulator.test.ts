/**
 * Sprint simulator tests (Story 48.1).
 */
import { describe, expect, it } from "vitest";
import { simulateSprint, getSimulationColor, type SimulationInput } from "../sprint-simulator.js";
import type { SessionLearning } from "../types.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "s-1",
    agentId: "a-1",
    storyId: "1-1",
    projectId: "proj",
    outcome: "completed",
    durationMs: 4 * HOUR,
    retryCount: 0,
    filesModified: [],
    testsAdded: 0,
    errorCategories: [],
    domainTags: ["backend"],
    completedAt: "2026-03-24T10:00:00Z",
    capturedAt: "2026-03-24T10:00:01Z",
    ...overrides,
  };
}

describe("simulateSprint", () => {
  it("returns valid percentiles", () => {
    const input: SimulationInput = {
      stories: [
        { id: "s-1", domainTags: ["backend"] },
        { id: "s-2", domainTags: ["backend"] },
      ],
      learnings: [
        makeLearning({ durationMs: 3 * HOUR }),
        makeLearning({ durationMs: 5 * HOUR }),
        makeLearning({ durationMs: 4 * HOUR }),
      ],
      iterations: 100,
      seed: 42,
    };

    const result = simulateSprint(input);

    expect(result.p50Days).toBeGreaterThan(0);
    expect(result.p80Days).toBeGreaterThanOrEqual(result.p50Days);
    expect(result.p95Days).toBeGreaterThanOrEqual(result.p80Days);
    expect(result.iterationsRun).toBe(100);
  });

  it("produces deterministic results with same seed", () => {
    const input: SimulationInput = {
      stories: [{ id: "s-1", domainTags: ["frontend"] }],
      learnings: [
        makeLearning({ durationMs: 2 * HOUR, domainTags: ["frontend"] }),
        makeLearning({ durationMs: 6 * HOUR, domainTags: ["frontend"] }),
      ],
      iterations: 50,
      seed: 123,
    };

    const r1 = simulateSprint(input);
    const r2 = simulateSprint(input);

    expect(r1.p50Days).toBe(r2.p50Days);
    expect(r1.p95Days).toBe(r2.p95Days);
  });

  it("uses default duration when no matching history", () => {
    const input: SimulationInput = {
      stories: [{ id: "s-1", domainTags: ["unknown-domain"] }],
      learnings: [makeLearning({ domainTags: ["backend"] })],
      iterations: 10,
      defaultDurationMs: 8 * HOUR,
      seed: 1,
    };

    const result = simulateSprint(input);

    // All iterations use default 8h → p50 should be ~0.3 days
    expect(result.p50Days).toBeCloseTo(8 / 24, 1);
    expect(result.confidence).toBe(0); // No matches
  });

  it("computes on-time probability", () => {
    const input: SimulationInput = {
      stories: [{ id: "s-1", domainTags: ["backend"] }],
      learnings: [makeLearning({ durationMs: 2 * HOUR })],
      iterations: 100,
      sprintEndMs: 1 * DAY, // 24h deadline
      seed: 42,
    };

    const result = simulateSprint(input);

    // 2h per story, 24h deadline → should be 100% on time
    expect(result.onTimeProbability).toBe(1);
  });

  it("low on-time probability when deadline is tight", () => {
    const input: SimulationInput = {
      stories: Array.from({ length: 10 }, (_, i) => ({
        id: `s-${i}`,
        domainTags: ["backend"],
      })),
      learnings: [makeLearning({ durationMs: 8 * HOUR })],
      iterations: 100,
      sprintEndMs: 1 * DAY, // 24h for 10 stories × 8h = 80h
      seed: 42,
    };

    const result = simulateSprint(input);

    expect(result.onTimeProbability).toBe(0); // Impossible
  });

  it("computes confidence from matching ratio", () => {
    const input: SimulationInput = {
      stories: [
        { id: "s-1", domainTags: ["backend"] },
        { id: "s-2", domainTags: ["frontend"] },
        { id: "s-3", domainTags: ["unknown"] },
      ],
      learnings: [
        makeLearning({ domainTags: ["backend"] }),
        makeLearning({ domainTags: ["frontend"] }),
      ],
      iterations: 10,
      seed: 1,
    };

    const result = simulateSprint(input);

    // 2 of 3 stories have matching data → 0.67
    expect(result.confidence).toBeCloseTo(0.67, 1);
  });

  it("returns zero for empty backlog", () => {
    const result = simulateSprint({
      stories: [],
      learnings: [],
      iterations: 100,
      seed: 1,
    });

    expect(result.p50Days).toBe(0);
    expect(result.onTimeProbability).toBe(1);
    expect(result.iterationsRun).toBe(0);
  });

  it("returns zero for zero iterations", () => {
    const result = simulateSprint({
      stories: [{ id: "s-1", domainTags: ["a"] }],
      learnings: [],
      iterations: 0,
      seed: 1,
    });

    expect(result.iterationsRun).toBe(0);
  });
});

describe("getSimulationColor", () => {
  it("returns green for >80%", () => {
    expect(getSimulationColor(0.85)).toBe("green");
    expect(getSimulationColor(1)).toBe("green");
  });

  it("returns amber for 50-80%", () => {
    expect(getSimulationColor(0.5)).toBe("amber");
    expect(getSimulationColor(0.8)).toBe("amber");
  });

  it("returns red for <50%", () => {
    expect(getSimulationColor(0.49)).toBe("red");
    expect(getSimulationColor(0)).toBe("red");
  });
});
