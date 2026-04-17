import { describe, expect, it } from "vitest";
import type {
  ResourceConflict,
  ResourceConflictType,
  ResourceConflictSeverity,
} from "../resource-conflict.js";
import type { OrchestratorConfig } from "../types.js";
import {
  generateSuggestionId,
  computeImpactEstimate,
  generateSuggestions,
  selectRecommendedStrategy,
} from "../resource-conflict-suggestions.js";

// =============================================================================
// Test Helpers
// =============================================================================

function makeConflict(
  overrides: Partial<ResourceConflict> & {
    resourceType: ResourceConflictType;
    severity: ResourceConflictSeverity;
  },
): ResourceConflict {
  return {
    id: "conflict-test-001",
    resourceIdentifier: "https://github.com/org/repo",
    competingProjects: ["proj-a", "proj-b"],
    detectedAt: "2026-04-01T12:00:00Z",
    metadata: {},
    ...overrides,
  };
}

function makeConfig(
  projects?: Record<string, { sharedPool?: { enabled: boolean } }>,
): OrchestratorConfig {
  return {
    projects: (projects ?? {}) as OrchestratorConfig["projects"],
    maxConcurrentAgents: 5,
  } as OrchestratorConfig;
}

// =============================================================================
// generateSuggestionId
// =============================================================================

describe("generateSuggestionId", () => {
  it("returns a string starting with 'suggestion-'", () => {
    const id = generateSuggestionId();
    expect(id).toMatch(/^suggestion-/);
  });

  it("contains a base36 timestamp and hex random component", () => {
    const id = generateSuggestionId();
    // Format: suggestion-<base36>-<8-hex-chars>
    const parts = id.split("-");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("suggestion");
    expect(parts[1]).toMatch(/^[0-9a-z]+$/);
    expect(parts[2]).toMatch(/^[0-9a-f]{8}$/);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateSuggestionId()));
    expect(ids.size).toBe(20);
  });
});

// =============================================================================
// computeImpactEstimate
// =============================================================================

describe("computeImpactEstimate", () => {
  const conflict = makeConflict({
    resourceType: "repository",
    severity: "high",
    competingProjects: ["proj-a", "proj-b", "proj-c"],
  });

  it("returns delay estimate for sequential-scheduling", () => {
    const result = computeImpactEstimate(conflict, "sequential-scheduling");
    expect(result).toContain("3 work cycles");
  });

  it("returns elimination message for resource-isolation", () => {
    const result = computeImpactEstimate(conflict, "resource-isolation");
    expect(result).toContain("Eliminates conflict");
  });

  it("returns reassignment detail for agent-reassignment with 2+ projects", () => {
    const result = computeImpactEstimate(conflict, "agent-reassignment");
    expect(result).toContain("proj-a");
    expect(result).toContain("proj-b");
    expect(result).toContain("Reassigns agent from");
  });

  it("returns generic reassignment message for single project", () => {
    const singleConflict = makeConflict({
      resourceType: "agent",
      severity: "medium",
      competingProjects: ["proj-a"],
    });
    const result = computeImpactEstimate(singleConflict, "agent-reassignment");
    expect(result).toContain("Reassigns agent");
  });

  it("returns capacity estimate for increase-capacity", () => {
    const result = computeImpactEstimate(conflict, "increase-capacity");
    expect(result).toContain("3 more capacity");
  });

  it("returns offset estimate for stagger-schedules", () => {
    const result = computeImpactEstimate(conflict, "stagger-schedules");
    expect(result).toContain("45 minutes"); // 3 projects * 15
    expect(result).toContain("20%"); // max(10, 80 - 3*20) = 20
  });
});

// =============================================================================
// generateSuggestions
// =============================================================================

describe("generateSuggestions", () => {
  it("returns empty array for unknown resource type", () => {
    const conflict = makeConflict({
      resourceType: "unknown" as ResourceConflictType,
      severity: "high",
    });
    expect(generateSuggestions(conflict)).toEqual([]);
  });

  it("returns empty array for low severity", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "low",
    });
    expect(generateSuggestions(conflict)).toEqual([]);
  });

  // --- Repository conflicts ---

  it("generates 3 suggestions for repository conflict with high severity", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "high",
    });
    const suggestions = generateSuggestions(conflict);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.strategy)).toEqual([
      "sequential-scheduling",
      "resource-isolation",
      "stagger-schedules",
    ]);
  });

  it("marks sequential-scheduling as recommended for high severity", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "high",
    });
    const suggestions = generateSuggestions(conflict);
    const recommended = suggestions.find((s) => s.recommended);
    expect(recommended?.strategy).toBe("sequential-scheduling");
  });

  it("marks resource-isolation as recommended for critical severity", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "critical",
    });
    const suggestions = generateSuggestions(conflict);
    const recommended = suggestions.find((s) => s.recommended);
    expect(recommended?.strategy).toBe("resource-isolation");
  });

  it("marks stagger-schedules as recommended for medium severity", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "medium",
    });
    const suggestions = generateSuggestions(conflict);
    const recommended = suggestions.find((s) => s.recommended);
    expect(recommended?.strategy).toBe("stagger-schedules");
  });

  // --- Agent conflicts ---

  it("generates 3 suggestions for agent conflict", () => {
    const conflict = makeConflict({
      resourceType: "agent",
      severity: "high",
      resourceIdentifier: "agent-001",
    });
    const suggestions = generateSuggestions(conflict);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.strategy)).toEqual([
      "agent-reassignment",
      "increase-capacity",
      "stagger-schedules",
    ]);
  });

  it("skips agent-reassignment when no shared pool configured for agent conflict", () => {
    const conflict = makeConflict({
      resourceType: "agent",
      severity: "high",
      resourceIdentifier: "agent-001",
    });
    const config = makeConfig(); // No shared pool
    const suggestions = generateSuggestions(conflict, config);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.strategy)).not.toContain("agent-reassignment");
  });

  it("includes agent-reassignment when shared pool is enabled", () => {
    const conflict = makeConflict({
      resourceType: "agent",
      severity: "high",
      resourceIdentifier: "agent-001",
      competingProjects: ["proj-a"],
    });
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true } },
    });
    const suggestions = generateSuggestions(conflict, config);
    expect(suggestions.map((s) => s.strategy)).toContain("agent-reassignment");
  });

  // --- File path conflicts ---

  it("generates 2 suggestions for file-path conflict", () => {
    const conflict = makeConflict({
      resourceType: "file-path",
      severity: "high",
      resourceIdentifier: "/src/shared/utils.ts",
    });
    const suggestions = generateSuggestions(conflict);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.strategy)).toEqual([
      "sequential-scheduling",
      "resource-isolation",
    ]);
  });

  // --- External service conflicts ---

  it("generates 2 suggestions for external-service conflict", () => {
    const conflict = makeConflict({
      resourceType: "external-service",
      severity: "medium",
      resourceIdentifier: "api.openai.com",
    });
    const suggestions = generateSuggestions(conflict);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.strategy)).toEqual(["stagger-schedules", "increase-capacity"]);
  });

  // --- Suggestion structure ---

  it("each suggestion has all required fields", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "high",
    });
    const suggestions = generateSuggestions(conflict);
    for (const s of suggestions) {
      expect(s.id).toMatch(/^suggestion-/);
      expect(s.conflictId).toBe("conflict-test-001");
      expect(s.strategy).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.impactEstimate).toBeTruthy();
      expect(typeof s.recommended).toBe("boolean");
      expect(Array.isArray(s.actions)).toBe(true);
      expect(s.actions.length).toBeGreaterThan(0);
    }
  });

  it("exactly one suggestion is marked as recommended", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "high",
    });
    const suggestions = generateSuggestions(conflict);
    const recommendedCount = suggestions.filter((s) => s.recommended).length;
    expect(recommendedCount).toBe(1);
  });

  it("first suggestion is marked recommended when severity strategy is not in list", () => {
    // Critical severity recommends "resource-isolation" which IS in agent strategies
    // but not for file-path. Actually it IS in file-path strategies.
    // Let's test with external-service where critical recommends "resource-isolation"
    // which is NOT in its strategy list
    const conflict = makeConflict({
      resourceType: "external-service",
      severity: "critical",
    });
    const suggestions = generateSuggestions(conflict);
    // external-service strategies: stagger-schedules, increase-capacity
    // critical recommends: resource-isolation (not in list)
    // So first should be marked recommended
    expect(suggestions[0].recommended).toBe(true);
  });
});

// =============================================================================
// selectRecommendedStrategy
// =============================================================================

describe("selectRecommendedStrategy", () => {
  it("returns the first recommended suggestion", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "high",
    });
    const suggestions = generateSuggestions(conflict);
    const result = selectRecommendedStrategy(suggestions);
    expect(result).not.toBeNull();
    expect(result?.strategy).toBe("sequential-scheduling");
    expect(result?.recommended).toBe(true);
  });

  it("returns null for empty array", () => {
    expect(selectRecommendedStrategy([])).toBeNull();
  });

  it("returns null when no suggestion is marked recommended", () => {
    const suggestions = [
      {
        id: "suggestion-1",
        conflictId: "conflict-1",
        strategy: "sequential-scheduling" as const,
        description: "desc",
        impactEstimate: "impact",
        recommended: false,
        actions: [],
      },
    ];
    expect(selectRecommendedStrategy(suggestions)).toBeNull();
  });
});

// =============================================================================
// Integration: full suggestion pipeline
// =============================================================================

describe("suggestion generation pipeline", () => {
  it("generates complete response for a critical repository conflict", () => {
    const conflict = makeConflict({
      resourceType: "repository",
      severity: "critical",
      competingProjects: ["alpha", "beta"],
    });

    const suggestions = generateSuggestions(conflict);
    const recommended = selectRecommendedStrategy(suggestions);

    // Should have 3 suggestions
    expect(suggestions).toHaveLength(3);

    // Recommended should be resource-isolation for critical
    expect(recommended?.strategy).toBe("resource-isolation");

    // All suggestions reference the same conflict
    expect(suggestions.every((s) => s.conflictId === conflict.id)).toBe(true);

    // All IDs are unique
    const ids = new Set(suggestions.map((s) => s.id));
    expect(ids.size).toBe(3);
  });

  it("generates complete response for a medium agent conflict with shared pool", () => {
    const conflict = makeConflict({
      resourceType: "agent",
      severity: "medium",
      resourceIdentifier: "agent-x",
      competingProjects: ["proj-a", "proj-b"],
    });
    const config = makeConfig({
      "proj-a": { sharedPool: { enabled: true } },
    });

    const suggestions = generateSuggestions(conflict, config);
    const recommended = selectRecommendedStrategy(suggestions);

    expect(suggestions).toHaveLength(3);
    expect(recommended?.strategy).toBe("stagger-schedules");
  });

  it("handles single competing project gracefully", () => {
    const conflict = makeConflict({
      resourceType: "file-path",
      severity: "high",
      competingProjects: ["only-project"],
    });

    const suggestions = generateSuggestions(conflict);
    expect(suggestions.length).toBeGreaterThan(0);

    // Impact estimate should handle single project
    for (const s of suggestions) {
      expect(s.impactEstimate).toBeTruthy();
    }
  });
});
