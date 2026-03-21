import { describe, it, expect, beforeEach } from "vitest";
import { lkgCache } from "../lkg-cache";
import type { WorkflowResponse } from "../types";

function makeResponse(overrides: Partial<WorkflowResponse> = {}): WorkflowResponse {
  return {
    projectId: "test",
    projectName: "Test Project",
    hasBmad: true,
    phases: [
      { id: "analysis", label: "Analysis", state: "done" },
      { id: "planning", label: "Planning", state: "active" },
      { id: "solutioning", label: "Solutioning", state: "not-started" },
      { id: "implementation", label: "Implementation", state: "not-started" },
    ],
    agents: [{ name: "dev", displayName: "Dev", title: "Developer", icon: "🤖", role: "dev" }],
    recommendation: { tier: 1, observation: "obs", implication: "imp", phase: "analysis" },
    artifacts: [
      {
        filename: "prd.md",
        path: "_bmad-output/prd.md",
        modifiedAt: "2026-03-14T00:00:00Z",
        phase: "planning",
        type: "PRD",
      },
    ],
    lastActivity: { filename: "prd.md", phase: "planning", modifiedAt: "2026-03-14T00:00:00Z" },
    ...overrides,
  };
}

describe("WorkflowLkgCache", () => {
  beforeEach(() => {
    lkgCache._resetForTesting();
  });

  it("returns null on cold start (no cached data)", () => {
    expect(lkgCache.get("proj-a", "phases")).toBeNull();
    expect(lkgCache.get("proj-a", "agents")).toBeNull();
    expect(lkgCache.get("proj-a", "artifacts")).toBeNull();
    expect(lkgCache.get("proj-a", "recommendation")).toBeNull();
    expect(lkgCache.get("proj-a", "lastActivity")).toBeNull();
  });

  it("stores and retrieves a single field", () => {
    const phases = [{ id: "analysis" as const, label: "Analysis", state: "done" as const }];
    lkgCache.set("proj-a", "phases", phases);

    expect(lkgCache.get("proj-a", "phases")).toEqual(phases);
  });

  it("stores all fields from a WorkflowResponse via setAll", () => {
    const response = makeResponse();
    lkgCache.setAll("proj-a", response);

    expect(lkgCache.get("proj-a", "phases")).toEqual(response.phases);
    expect(lkgCache.get("proj-a", "agents")).toEqual(response.agents);
    expect(lkgCache.get("proj-a", "recommendation")).toEqual(response.recommendation);
    expect(lkgCache.get("proj-a", "artifacts")).toEqual(response.artifacts);
    expect(lkgCache.get("proj-a", "lastActivity")).toEqual(response.lastActivity);
  });

  it("maintains per-field independence — setting one field does not affect others", () => {
    const response = makeResponse();
    lkgCache.setAll("proj-a", response);

    // Update only agents
    lkgCache.set("proj-a", "agents", null);

    // Other fields unchanged
    expect(lkgCache.get("proj-a", "phases")).toEqual(response.phases);
    expect(lkgCache.get("proj-a", "recommendation")).toEqual(response.recommendation);
    expect(lkgCache.get("proj-a", "artifacts")).toEqual(response.artifacts);
    expect(lkgCache.get("proj-a", "lastActivity")).toEqual(response.lastActivity);
    // Updated field reflects change
    expect(lkgCache.get("proj-a", "agents")).toBeNull();
  });

  it("maintains per-project isolation", () => {
    const responseA = makeResponse({ projectId: "proj-a" });
    const responseB = makeResponse({
      projectId: "proj-b",
      agents: null,
      recommendation: null,
    });

    lkgCache.setAll("proj-a", responseA);
    lkgCache.setAll("proj-b", responseB);

    expect(lkgCache.get("proj-a", "agents")).toEqual(responseA.agents);
    expect(lkgCache.get("proj-b", "agents")).toBeNull();
    expect(lkgCache.get("proj-a", "recommendation")).toEqual(responseA.recommendation);
    expect(lkgCache.get("proj-b", "recommendation")).toBeNull();
  });

  it("builds full response from cached fields via getFullResponse", () => {
    const response = makeResponse();
    lkgCache.setAll("proj-a", response);

    const full = lkgCache.getFullResponse("proj-a", "Test Project");
    expect(full).not.toBeNull();
    expect(full!.projectId).toBe("proj-a");
    expect(full!.projectName).toBe("Test Project");
    expect(full!.hasBmad).toBe(true);
    expect(full!.phases).toEqual(response.phases);
    expect(full!.agents).toEqual(response.agents);
    expect(full!.recommendation).toEqual(response.recommendation);
    expect(full!.artifacts).toEqual(response.artifacts);
    expect(full!.lastActivity).toEqual(response.lastActivity);
  });

  it("returns null from getFullResponse when no cache exists for project", () => {
    expect(lkgCache.getFullResponse("nonexistent", "Name")).toBeNull();
  });

  it("clears all cached data via _resetForTesting", () => {
    lkgCache.setAll("proj-a", makeResponse());
    lkgCache.setAll("proj-b", makeResponse());

    lkgCache._resetForTesting();

    expect(lkgCache.get("proj-a", "phases")).toBeNull();
    expect(lkgCache.get("proj-b", "phases")).toBeNull();
    expect(lkgCache.getFullResponse("proj-a", "A")).toBeNull();
  });
});
