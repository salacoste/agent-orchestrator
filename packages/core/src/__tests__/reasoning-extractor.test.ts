/**
 * Reasoning extractor tests (Story 45.7).
 */
import { describe, expect, it } from "vitest";
import { extractReasoning, type ReasoningInput } from "../reasoning-extractor.js";

function makeInput(overrides: Partial<ReasoningInput> = {}): ReasoningInput {
  return {
    agentId: "agent-1",
    summary: null,
    domainTags: [],
    errorCategories: [],
    filesModified: [],
    retryCount: 0,
    ...overrides,
  };
}

describe("extractReasoning", () => {
  it("returns empty trail for no data", () => {
    const trail = extractReasoning(makeInput());

    expect(trail.agentId).toBe("agent-1");
    expect(trail.hasData).toBe(false);
    expect(trail.decisions).toHaveLength(0);
  });

  it("extracts decisions from summary with decision keywords", () => {
    const trail = extractReasoning(
      makeInput({
        summary:
          "Chose vitest over jest because it has native ESM support. Using TypeScript strict mode.",
      }),
    );

    expect(trail.hasData).toBe(true);
    const decisions = trail.decisions.filter((d) => d.decision.includes("vitest"));
    expect(decisions.length).toBeGreaterThan(0);
  });

  it("extracts rationale from 'because' clause", () => {
    const trail = extractReasoning(
      makeInput({ summary: "Selected React because it has better ecosystem support." }),
    );

    const decision = trail.decisions.find((d) => d.decision.includes("React"));
    expect(decision?.rationale).toContain("because");
  });

  it("categorizes library decisions", () => {
    const trail = extractReasoning(makeInput({ summary: "Chose the vitest library for testing." }));

    const libDecision = trail.decisions.find(
      (d) => d.category === "library" || d.category === "testing",
    );
    expect(libDecision).toBeDefined();
  });

  it("categorizes architecture decisions", () => {
    const trail = extractReasoning(
      makeInput({ summary: "Decided on a service layer pattern for separation." }),
    );

    const archDecision = trail.decisions.find((d) => d.category === "architecture");
    expect(archDecision).toBeDefined();
  });

  it("categorizes trade-off decisions", () => {
    const trail = extractReasoning(
      makeInput({ summary: "Used polling instead of WebSocket for simplicity." }),
    );

    const tradeoff = trail.decisions.find((d) => d.category === "trade-off");
    expect(tradeoff).toBeDefined();
  });

  it("infers domain approach from domain tags", () => {
    const trail = extractReasoning(makeInput({ domainTags: ["frontend", "testing"] }));

    const approach = trail.decisions.find((d) => d.category === "approach");
    expect(approach?.decision).toContain("frontend");
    expect(approach?.decision).toContain("testing");
  });

  it("infers retry-based reasoning", () => {
    const trail = extractReasoning(
      makeInput({ retryCount: 2, errorCategories: ["timeout", "exit_code_1"] }),
    );

    const retry = trail.decisions.find((d) => d.decision.includes("retry"));
    expect(retry).toBeDefined();
    expect(retry?.rationale).toContain("timeout");
  });

  it("uses singular for single retry", () => {
    const trail = extractReasoning(makeInput({ retryCount: 1 }));

    const retry = trail.decisions.find((d) => d.decision.includes("retry"));
    expect(retry?.decision).toContain("1 retry attempt");
    expect(retry?.decision).not.toContain("attempts");
  });

  it("infers test-focused approach from file patterns", () => {
    const trail = extractReasoning(
      makeInput({
        filesModified: [
          "src/index.ts",
          "src/__tests__/index.test.ts",
          "src/__tests__/utils.test.ts",
        ],
      }),
    );

    const testing = trail.decisions.find((d) => d.category === "testing");
    expect(testing).toBeDefined();
    expect(testing?.decision).toContain("2/3");
  });

  it("does not infer test approach when test ratio is low", () => {
    const trail = extractReasoning(
      makeInput({
        filesModified: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/__tests__/a.test.ts"],
      }),
    );

    // 1/5 = 20% — below 40% threshold
    const testing = trail.decisions.find(
      (d) => d.category === "testing" && d.decision.includes("Test-focused"),
    );
    expect(testing).toBeUndefined();
  });

  it("handles summary with no decision keywords", () => {
    const trail = extractReasoning(
      makeInput({ summary: "Working on implementing the feature. Made progress today." }),
    );

    // No decision keywords → no summary-based decisions
    const summaryDecisions = trail.decisions.filter(
      (d) => d.category !== "approach" && d.category !== "testing",
    );
    expect(summaryDecisions).toHaveLength(0);
  });

  it("filters short sentences", () => {
    const trail = extractReasoning(makeInput({ summary: "OK. Chose A." }));

    // "OK" is too short (< 10 chars), "Chose A" is 7 chars — both filtered
    expect(trail.decisions.filter((d) => d.decision === "OK")).toHaveLength(0);
  });
});
