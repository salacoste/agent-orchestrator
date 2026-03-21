import { describe, expect, it } from "vitest";

import { aggregateProjectContext, generateInsights } from "../project-context-aggregator";
import type { Phase, PhaseEntry } from "../types";

function makePhases(active: Phase | null): PhaseEntry[] {
  return (["analysis", "planning", "solutioning", "implementation"] as Phase[]).map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    state:
      active === id
        ? "active"
        : active &&
            ["analysis", "planning", "solutioning", "implementation"].indexOf(id) <
              ["analysis", "planning", "solutioning", "implementation"].indexOf(active)
          ? "done"
          : "not-started",
  }));
}

describe("aggregateProjectContext", () => {
  it("produces context with phase summary", () => {
    const ctx = aggregateProjectContext(makePhases("solutioning"), [], 5, 10, 2);
    expect(ctx.phaseSummary).toContain("Solutioning");
    expect(ctx.phaseSummary).toContain("active");
  });

  it("produces sprint progress percentage", () => {
    const ctx = aggregateProjectContext(makePhases(null), [], 7, 10, 0);
    expect(ctx.sprintSummary).toContain("70%");
  });

  it("includes agent count", () => {
    const ctx = aggregateProjectContext(makePhases("analysis"), [], 0, 5, 3);
    expect(ctx.agentSummary).toContain("3 active agents");
  });

  it("estimates token count", () => {
    const ctx = aggregateProjectContext(makePhases("planning"), [], 0, 5, 0);
    expect(ctx.estimatedTokens).toBeGreaterThan(0);
    expect(ctx.estimatedTokens).toBeLessThan(8000); // Under 8K budget
  });

  it("fullContext is a non-empty string", () => {
    const ctx = aggregateProjectContext(makePhases("analysis"), [], 0, 0, 0);
    expect(ctx.fullContext.length).toBeGreaterThan(0);
  });
});

describe("generateInsights", () => {
  it("flags blocked stories", () => {
    const insights = generateInsights(5, 10, 2, 3);
    expect(insights.some((i) => i.id === "blocked-stories")).toBe(true);
    expect(insights.find((i) => i.id === "blocked-stories")?.severity).toBe("action");
  });

  it("warns when behind schedule", () => {
    const insights = generateInsights(2, 10, 0, 1);
    expect(insights.some((i) => i.id === "behind-schedule")).toBe(true);
  });

  it("flags no active agents", () => {
    const insights = generateInsights(3, 10, 0, 0);
    expect(insights.some((i) => i.id === "no-agents")).toBe(true);
  });

  it("returns positive insight when all good", () => {
    const insights = generateInsights(8, 10, 0, 2);
    expect(insights.some((i) => i.id === "all-good")).toBe(true);
    expect(insights[0].severity).toBe("info");
  });

  it("returns empty when no blocked + no behind + has agents", () => {
    // 80% done, no blockers, agents running → "all good"
    const insights = generateInsights(8, 10, 0, 2);
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe("all-good");
  });
});
