/**
 * Unit tests for OptimizationPanel component (Story 56.7).
 * Tests rendering, category filtering, accept/dismiss actions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OptimizationPanel } from "../OptimizationPanel.js";
import type {
  OptimizationEngineResult,
  ObjectiveScenarioResult,
  ObjectiveComparisonSummary,
  ImpactAnalysis,
} from "@/lib/optimization-types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSuggestions: OptimizationEngineResult = {
  suggestions: [
    {
      id: "opt-1",
      category: "agent-rebalancing",
      title: "Rebalance agent-a from p1 to p2",
      description: "Test rebalance suggestion",
      impact: {
        daysSaved: 2.5,
        riskReductionPercent: 15,
        utilizationDeltaPercent: 10,
        affectedAgents: ["agent-a"],
        affectedProjects: ["p1", "p2"],
        affectedStories: [],
      },
      confidence: 85,
      priority: 50,
      createdAt: 1000,
      data: { agentId: "agent-a", isPoolAgent: true },
    },
    {
      id: "opt-2",
      category: "wip-adjustment",
      title: "Increase WIP limit: review column",
      description: "Test WIP suggestion",
      impact: {
        daysSaved: 1.2,
        riskReductionPercent: 8,
        utilizationDeltaPercent: 0,
        affectedAgents: [],
        affectedProjects: ["p1"],
        affectedStories: ["s1", "s2"],
      },
      confidence: 70,
      priority: 30,
      createdAt: 2000,
      data: { bottleneckId: "bn-1" },
    },
  ],
  analysisTimeMs: 42,
  inputSummary: {
    projectCount: 2,
    agentCount: 3,
    overutilizedCount: 1,
    underutilizedCount: 1,
    bottleneckCount: 2,
  },
};

const emptyResult: OptimizationEngineResult = {
  suggestions: [],
  analysisTimeMs: 5,
  inputSummary: {
    projectCount: 1,
    agentCount: 1,
    overutilizedCount: 0,
    underutilizedCount: 0,
    bottleneckCount: 0,
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(data: OptimizationEngineResult, ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchPatch(ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: () => Promise.resolve({ success: true }),
  } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OptimizationPanel", () => {
  it("renders suggestions after loading", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[{ id: "p1", name: "Project 1" }]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });
    expect(screen.getByText("Increase WIP limit: review column")).toBeInTheDocument();
    expect(screen.getByText(/42ms/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockFetch(
      new Promise<OptimizationEngineResult>(() => {}) as unknown as OptimizationEngineResult,
    );

    render(<OptimizationPanel projects={[]} />);
    expect(screen.getByText("Loading optimization suggestions...")).toBeInTheDocument();
  });

  it("shows empty state when no suggestions", async () => {
    mockFetch(emptyResult);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("No optimization suggestions available")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockFetch({} as OptimizationEngineResult, false);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading optimization data/)).toBeInTheDocument();
    });
  });

  it("displays category filter chips", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    expect(screen.getByText("All")).toBeInTheDocument();
    // Category names appear in both filter chips and card badges
    expect(screen.getAllByText("Rebalancing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("WIP Adjust").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Capacity")).toBeInTheDocument();
    expect(screen.getByText("Underutilized")).toBeInTheDocument();
  });

  it("shows confidence and impact metrics", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      // Title renders
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });
    // Confidence badge and impact metrics rendered
    expect(screen.getByText(/85/)).toBeInTheDocument();
    expect(screen.getByText(/2\.5 days saved/)).toBeInTheDocument();
    expect(screen.getByText(/15% risk reduction/)).toBeInTheDocument();
    expect(screen.getByText(/\+10% utilization/)).toBeInTheDocument();
  });

  it("calls PATCH on accept", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    // After initial load, mock PATCH
    mockFetchPatch();

    const acceptButtons = screen.getAllByRole("button", { name: /Accept suggestion/ });
    await fireEvent.click(acceptButtons[0]);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/risk/optimization",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"category":"agent-rebalancing"'),
        }),
      );
    });
  });

  it("calls PATCH on dismiss", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    mockFetchPatch();

    const dismissButtons = screen.getAllByRole("button", { name: /Dismiss suggestion/ });
    await fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/risk/optimization",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"category":"agent-rebalancing"'),
        }),
      );
    });
  });

  it("removes suggestion from list after accept", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    mockFetchPatch();

    const acceptButtons = screen.getAllByRole("button", { name: /Accept suggestion/ });
    await fireEvent.click(acceptButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("Rebalance agent-a from p1 to p2")).not.toBeInTheDocument();
    });
  });

  it("renders category badge with correct text", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      // Category badges render on suggestion cards
      expect(screen.getAllByText("Rebalancing").length).toBeGreaterThanOrEqual(1);
    });
    const badges = screen.getAllByText("WIP Adjust");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // Story 56.8 — Objective selector & comparison
  // ---------------------------------------------------------------------------

  it("renders objective selector with 5 options", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Select optimization objective") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(5); // baseline + 4 objectives
  });

  it("renders Compare Objectives button", async () => {
    mockFetch(mockSuggestions);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Compare all objectives")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Story 56.8 — Objective scenario & comparison tests
// ---------------------------------------------------------------------------

const mockScenarioResult: ObjectiveScenarioResult = {
  objective: "minimize-time",
  suggestions: [
    {
      id: "opt-priority-1",
      category: "priority-reorder",
      title: "Prioritize stuck story",
      description: "Reorder to unblock",
      impact: {
        daysSaved: 5,
        riskReductionPercent: 20,
        utilizationDeltaPercent: 0,
        affectedAgents: [],
        affectedProjects: ["p1"],
        affectedStories: ["s1"],
      },
      confidence: 90,
      priority: 80,
      createdAt: 3000,
      data: {},
    },
  ],
  analysisTimeMs: 15,
  inputSummary: {
    projectCount: 1,
    agentCount: 2,
    overutilizedCount: 1,
    underutilizedCount: 1,
    bottleneckCount: 1,
  },
  baselineComparison: {
    topSuggestionMoved: true,
    rankChanges: [
      { suggestionId: "opt-priority-1", baselineRank: 2, objectiveRank: 0, rankDelta: 2 },
    ],
  },
};

const mockComparison: ObjectiveComparisonSummary = {
  objectives: [
    {
      objective: "minimize-time",
      topSuggestions: mockScenarioResult.suggestions,
      projectedImpact: {
        daysSaved: 5,
        riskReductionPercent: 20,
        utilizationDeltaPercent: 0,
        affectedAgents: [],
        affectedProjects: ["p1"],
        affectedStories: ["s1"],
      },
    },
    {
      objective: "maximize-throughput",
      topSuggestions: [],
      projectedImpact: {
        daysSaved: 0,
        riskReductionPercent: 0,
        utilizationDeltaPercent: 0,
        affectedAgents: [],
        affectedProjects: [],
        affectedStories: [],
      },
    },
  ],
  baselineTopSuggestions: mockSuggestions.suggestions.slice(0, 3),
  analysisTimeMs: 30,
};

describe("OptimizationPanel — objective & comparison", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchUrl(url: string, data: unknown, ok = true) {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const target =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target === url) {
        return Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);
      }
      // Default baseline
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      } as Response);
    });
  }

  it("fetches objective scenario when objective selected", async () => {
    mockFetchUrl("/api/risk/optimization", mockSuggestions);
    mockFetchUrl("/api/risk/optimization?objective=minimize-time", mockScenarioResult);

    // Setup: mock fetch to return different data based on URL
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const target =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target.includes("objective=minimize-time")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScenarioResult),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      } as Response);
    });

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Select optimization objective");
    await fireEvent.change(select, { target: { value: "minimize-time" } });

    await waitFor(() => {
      expect(screen.getByText("Prioritize stuck story")).toBeInTheDocument();
    });
  });

  it("shows comparison panel when Compare Objectives clicked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const target =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target.includes("compare=true")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockComparison),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      } as Response);
    });

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    const compareBtn = screen.getByLabelText("Compare all objectives");
    await fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(screen.getByText("Objective Comparison")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Minimize Time").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Story 56.10 — Impact analysis (Compare Impact button)
// ---------------------------------------------------------------------------

const mockImpactAnalysis: ImpactAnalysis = {
  completionDateShift: 2.5,
  velocityDelta: 0.08,
  riskChange: { before: 60, after: 51, delta: 9 },
  beforeMetrics: {
    utilizationPercent: 50,
    velocity: 0.4,
    riskScore: 60,
    activeAgents: 3,
    storiesAtRisk: 2,
  },
  afterMetrics: {
    utilizationPercent: 60,
    velocity: 0.48,
    riskScore: 51,
    activeAgents: 3,
    storiesAtRisk: 2,
  },
};

describe("OptimizationPanel — Story 56.10 impact analysis", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Compare Impact button and shows ImpactDetail on click", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const target =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target.includes("impact=true")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              suggestions: [
                { suggestion: mockSuggestions.suggestions[0], impactAnalysis: mockImpactAnalysis },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      } as Response);
    });

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    // "Compare Impact" button appears on the first suggestion card
    const compareBtns = screen.getAllByRole("button", { name: "Compare impact before and after" });
    expect(compareBtns.length).toBeGreaterThanOrEqual(1);

    await fireEvent.click(compareBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Impact Analysis")).toBeInTheDocument();
    });

    // Before/after values rendered in impact detail
    expect(screen.getByText("Velocity:")).toBeInTheDocument();
    expect(screen.getByText("Risk Score:")).toBeInTheDocument();
    expect(screen.getByText("Utilization:")).toBeInTheDocument();
  });

  it("hides ImpactDetail on second click of Compare Impact", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const target =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target.includes("impact=true")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              suggestions: [
                { suggestion: mockSuggestions.suggestions[0], impactAnalysis: mockImpactAnalysis },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      } as Response);
    });

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    const compareBtns = screen.getAllByRole("button", { name: "Compare impact before and after" });
    await fireEvent.click(compareBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Impact Analysis")).toBeInTheDocument();
    });

    // Click again to hide
    await fireEvent.click(compareBtns[0]);
    expect(screen.queryByText("Impact Analysis")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Story 56.11 — Reset Learning button
// ---------------------------------------------------------------------------

describe("OptimizationPanel — Story 56.11 reset learning", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Reset Learning button", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestions),
    } as Response);

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Reset learning model")).toBeInTheDocument();
  });

  it("calls DELETE and re-fetches on Reset Learning click", async () => {
    // Stub window.confirm to return true
    vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const target =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target.includes("impact=true")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              suggestions: [
                { suggestion: mockSuggestions.suggestions[0], impactAnalysis: mockImpactAnalysis },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      } as Response);
    });

    render(<OptimizationPanel projects={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Rebalance agent-a from p1 to p2")).toBeInTheDocument();
    });

    const resetBtn = screen.getByLabelText("Reset learning model");
    await fireEvent.click(resetBtn);

    expect(window.confirm).toHaveBeenCalledWith(
      "Reset learning model? This will clear all feedback history.",
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/risk/optimization", {
        method: "DELETE",
      });
    });
  });
});
