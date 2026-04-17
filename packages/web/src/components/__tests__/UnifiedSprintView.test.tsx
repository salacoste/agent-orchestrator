import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedSprintView } from "../UnifiedSprintView";
import type { UnifiedSprintEntry, UnifiedSprintSummary } from "@/lib/types";

function createMockSprint(overrides: Partial<UnifiedSprintEntry> = {}): UnifiedSprintEntry {
  return {
    projectId: "proj-a",
    projectName: "Project A",
    sprintName: "Sprint 1",
    startDate: null,
    endDate: null,
    stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
    progressPercent: 50,
    status: "active",
    health: "on-track",
    healthReasons: [],
    velocity: 0,
    velocityTrend: "unknown" as const,
    ...overrides,
  };
}

const emptySummary: UnifiedSprintSummary = {
  totalSprints: 0,
  activeSprints: 0,
  completedSprints: 0,
  planningSprints: 0,
  totalStories: 0,
  storiesDone: 0,
  avgProgress: 0,
  atRiskSprints: 0,
  avgVelocity: 0,
  maxVelocity: 0,
};

describe("UnifiedSprintView", () => {
  it("renders page heading", () => {
    render(
      <UnifiedSprintView initialSprints={[createMockSprint()]} initialSummary={emptySummary} />,
    );
    expect(screen.getByText("Unified Sprints")).toBeInTheDocument();
  });

  it("renders empty state when no sprints", () => {
    render(<UnifiedSprintView initialSprints={[]} initialSummary={emptySummary} />);
    expect(
      screen.getByText("No sprint data found. Configure projects to see unified sprint view."),
    ).toBeInTheDocument();
  });

  it("renders sprint cards for each sprint", () => {
    const sprints = [
      createMockSprint({ projectId: "a", projectName: "Alpha" }),
      createMockSprint({ projectId: "b", projectName: "Beta" }),
    ];
    render(<UnifiedSprintView initialSprints={sprints} initialSummary={emptySummary} />);
    // "Alpha" and "Beta" appear in both SprintCards and VelocityComparisonTable
    expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Beta").length).toBeGreaterThanOrEqual(1);
  });

  it("renders summary cards", () => {
    const summary: UnifiedSprintSummary = {
      totalSprints: 3,
      activeSprints: 2,
      completedSprints: 1,
      planningSprints: 0,
      totalStories: 30,
      storiesDone: 20,
      avgProgress: 67,
      atRiskSprints: 0,
      avgVelocity: 0,
      maxVelocity: 0,
    };
    render(<UnifiedSprintView initialSprints={[createMockSprint()]} initialSummary={summary} />);
    expect(screen.getByText("Total Sprints")).toBeInTheDocument();
    expect(screen.getByText("Active Sprints")).toBeInTheDocument();
    expect(screen.getByText("Stories Done")).toBeInTheDocument();
    expect(screen.getByText("Avg Progress")).toBeInTheDocument();
  });

  it("renders SprintFilterBar", () => {
    const sprints = [
      createMockSprint({ projectId: "a", projectName: "Alpha" }),
      createMockSprint({ projectId: "b", projectName: "Beta" }),
    ];
    render(<UnifiedSprintView initialSprints={sprints} initialSummary={emptySummary} />);
    expect(screen.getByRole("search", { name: "Filter sprints" })).toBeInTheDocument();
  });

  it("filters sprint cards when status filter is applied", () => {
    const sprints = [
      createMockSprint({ projectId: "a", projectName: "Alpha", status: "active" }),
      createMockSprint({ projectId: "b", projectName: "Beta", status: "completed" }),
    ];
    render(<UnifiedSprintView initialSprints={sprints} initialSummary={emptySummary} />);

    // Filter to active only
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });

    // Only Alpha sprint card should be visible (Beta filtered out)
    // SprintCard renders projectName in an <h3>, dropdown options are <option>
    const cardHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(cardHeadings.map((h) => h.textContent)).toEqual(["Alpha"]);
  });

  it("restores all sprints when filters are cleared", () => {
    const sprints = [
      createMockSprint({ projectId: "a", projectName: "Alpha", status: "active" }),
      createMockSprint({ projectId: "b", projectName: "Beta", status: "completed" }),
    ];
    render(<UnifiedSprintView initialSprints={sprints} initialSummary={emptySummary} />);

    // Apply filter
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    let cardHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(cardHeadings.map((h) => h.textContent)).toEqual(["Alpha"]);

    // Clear filters
    fireEvent.click(screen.getByText("Clear filters"));
    cardHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(cardHeadings.map((h) => h.textContent)).toEqual(["Alpha", "Beta"]);
  });

  it("does not render SprintFilterBar when no sprints", () => {
    render(<UnifiedSprintView initialSprints={[]} initialSummary={emptySummary} />);
    expect(screen.queryByRole("search", { name: "Filter sprints" })).not.toBeInTheDocument();
  });
});
