import { describe, it, expect } from "vitest";
import { captureScenarioSnapshot, createScenario } from "../scenario-snapshot.js";
import type { ScenarioStorySnapshot } from "@/lib/types";

// =============================================================================
// captureScenarioSnapshot
// =============================================================================

describe("captureScenarioSnapshot", () => {
  const projectData = {
    alpha: {
      "1-1-sprint-plan-cli": "done",
      "1-2-agent-spawning": "in-progress",
      "1-3-tracking": { status: "backlog", domainTags: ["core", "agent"] },
      "epic-1": "done", // Should be skipped — not a story key
      "epic-1-retrospective": "done", // Should be skipped
    },
    beta: {
      "2-1-sync-bridge": "done",
      "2-2-events": { status: "blocked", domainTags: ["events"] },
      "3-1-notifications": "done",
    },
    gamma: {
      "10-1-health-check": "backlog",
    },
  };

  it("returns empty array when projectIds is empty", () => {
    expect(captureScenarioSnapshot(projectData, [])).toEqual([]);
  });

  it("returns empty array when no matching projects in data", () => {
    expect(captureScenarioSnapshot(projectData, ["nonexistent"])).toEqual([]);
  });

  it("filters to only selected projects", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha"]);
    expect(result.every((s) => s.projectId === "alpha")).toBe(true);
    expect(result).toHaveLength(3); // 3 stories, epics skipped
  });

  it("captures stories from multiple projects", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha", "beta"]);
    const projectIds = new Set(result.map((s) => s.projectId));
    expect(projectIds).toEqual(new Set(["alpha", "beta"]));
    expect(result).toHaveLength(6); // 3 alpha + 3 beta
  });

  it("maps string status entries correctly", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha"]);
    const story = result.find((s) => s.id === "1-1-sprint-plan-cli");
    expect(story).toEqual({
      id: "1-1-sprint-plan-cli",
      projectId: "alpha",
      status: "done",
      domainTags: [],
    });
  });

  it("maps object status entries with status field", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha"]);
    const story = result.find((s) => s.id === "1-3-tracking");
    expect(story?.status).toBe("backlog");
  });

  it("extracts domainTags from object entries", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha"]);
    const story = result.find((s) => s.id === "1-3-tracking");
    expect(story?.domainTags).toEqual(["core", "agent"]);
  });

  it("returns empty domainTags for string entries", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha"]);
    const story = result.find((s) => s.id === "1-2-agent-spawning");
    expect(story?.domainTags).toEqual([]);
  });

  it("skips epic entries (no X-Y-name pattern)", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha"]);
    const epicEntry = result.find((s) => s.id === "epic-1");
    expect(epicEntry).toBeUndefined();
  });

  it("skips retrospective entries", () => {
    const result = captureScenarioSnapshot(projectData, ["alpha"]);
    const retroEntry = result.find((s) => s.id === "epic-1-retrospective");
    expect(retroEntry).toBeUndefined();
  });

  it("handles project with no data gracefully", () => {
    const result = captureScenarioSnapshot({ gamma: {} }, ["gamma"]);
    expect(result).toEqual([]);
  });

  it("handles unknown status in object entry", () => {
    const data = {
      alpha: {
        "1-1-test": { status: undefined },
      },
    };
    const result = captureScenarioSnapshot(data, ["alpha"]);
    expect(result[0]?.status).toBe("unknown");
  });
});

// =============================================================================
// createScenario
// =============================================================================

describe("createScenario", () => {
  const stories: ScenarioStorySnapshot[] = [
    { id: "1-1-test", projectId: "alpha", status: "done", domainTags: [] },
  ];

  it("creates scenario with UUID id", () => {
    const scenario = createScenario("Test Scenario", ["alpha"], stories);
    expect(scenario.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("sets createdAt to ISO 8601 timestamp", () => {
    const before = new Date().toISOString();
    const scenario = createScenario("Test", ["alpha"], stories);
    const after = new Date().toISOString();
    expect(scenario.createdAt >= before).toBe(true);
    expect(scenario.createdAt <= after).toBe(true);
  });

  it("sets status to draft", () => {
    const scenario = createScenario("Test", ["alpha"], stories);
    expect(scenario.status).toBe("draft");
  });

  it("does not include result field (undefined)", () => {
    const scenario = createScenario("Test", ["alpha"], stories);
    expect(scenario.result).toBeUndefined();
  });

  it("stores provided projectIds", () => {
    const scenario = createScenario("Test", ["alpha", "beta"], stories);
    expect(scenario.projectIds).toEqual(["alpha", "beta"]);
  });

  it("stores provided stories", () => {
    const scenario = createScenario("Test", ["alpha"], stories);
    expect(scenario.stories).toEqual(stories);
  });

  it("trims whitespace from name", () => {
    const scenario = createScenario("  My Scenario  ", ["alpha"], stories);
    expect(scenario.name).toBe("My Scenario");
  });

  it("throws on empty name", () => {
    expect(() => createScenario("", ["alpha"], stories)).toThrow("Scenario name is required");
  });

  it("throws on whitespace-only name", () => {
    expect(() => createScenario("   ", ["alpha"], stories)).toThrow("Scenario name is required");
  });

  it("throws on empty projectIds", () => {
    expect(() => createScenario("Test", [], stories)).toThrow(
      "At least one project must be selected",
    );
  });

  it("creates scenario with empty stories array", () => {
    const scenario = createScenario("Empty", ["alpha"], []);
    expect(scenario.stories).toEqual([]);
  });
});
