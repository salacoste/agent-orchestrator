import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VelocityComparisonTable } from "../VelocityComparisonTable";
import type { UnifiedSprintEntry } from "@/lib/types";

function createMockSprint(overrides: Partial<UnifiedSprintEntry> = {}): UnifiedSprintEntry {
  return {
    projectId: "proj-a",
    projectName: "Project A",
    sprintName: "Sprint 1",
    startDate: "2026-01-01",
    endDate: "2026-01-14",
    stories: { total: 10, done: 5, inProgress: 3, blocked: 0, backlog: 2 },
    progressPercent: 50,
    status: "active",
    health: "on-track",
    healthReasons: [],
    velocity: 0.5,
    velocityTrend: "improving" as const,
    ...overrides,
  };
}

describe("VelocityComparisonTable", () => {
  it("renders table with project rows", () => {
    const sprints = [
      createMockSprint({ projectId: "a", projectName: "Alpha" }),
      createMockSprint({ projectId: "b", projectName: "Beta" }),
    ];
    render(<VelocityComparisonTable sprints={sprints} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("renders velocity values formatted to 2 decimal places", () => {
    const sprints = [createMockSprint({ projectId: "a", velocity: 1.5 })];
    render(<VelocityComparisonTable sprints={sprints} />);
    expect(screen.getByText("1.50 stories/day")).toBeInTheDocument();
  });

  it("sorts by velocity descending by default", () => {
    const sprints = [
      createMockSprint({ projectId: "slow", projectName: "Slow", velocity: 0.5 }),
      createMockSprint({ projectId: "fast", projectName: "Fast", velocity: 2.0 }),
    ];
    render(<VelocityComparisonTable sprints={sprints} />);
    const rows = screen.getAllByRole("row").slice(1); // skip header
    // Fast (2.0) should be first (rank 1), Slow (0.5) second (rank 2)
    expect(rows[0]).toHaveTextContent("Fast");
    expect(rows[1]).toHaveTextContent("Slow");
  });

  it("displays rank numbers based on sort order", () => {
    const sprints = [
      createMockSprint({ projectId: "a", velocity: 0.3 }),
      createMockSprint({ projectId: "b", velocity: 1.5 }),
      createMockSprint({ projectId: "c", velocity: 0.8 }),
    ];
    render(<VelocityComparisonTable sprints={sprints} />);
    const rows = screen.getAllByRole("row").slice(1);
    // Sorted desc by velocity: b(1.5), c(0.8), a(0.3) → ranks 1, 2, 3
    expect(rows[0]).toHaveTextContent("1");
    expect(rows[1]).toHaveTextContent("2");
    expect(rows[2]).toHaveTextContent("3");
  });

  it("renders trend indicators with correct symbols", () => {
    const sprints = [
      createMockSprint({ projectId: "a", velocityTrend: "improving" as const }),
      createMockSprint({ projectId: "b", velocityTrend: "declining" as const }),
      createMockSprint({ projectId: "c", velocityTrend: "stable" as const }),
      createMockSprint({ projectId: "d", velocityTrend: "unknown" as const }),
    ];
    render(<VelocityComparisonTable sprints={sprints} />);
    expect(screen.getByLabelText("Improving")).toHaveTextContent("▲");
    expect(screen.getByLabelText("Declining")).toHaveTextContent("▼");
    expect(screen.getByLabelText("Stable")).toHaveTextContent("—");
    expect(screen.getByLabelText("Unknown")).toHaveTextContent("?");
  });

  it("clicking velocity column header toggles sort direction", () => {
    const sprints = [
      createMockSprint({ projectId: "slow", projectName: "Slow", velocity: 0.5 }),
      createMockSprint({ projectId: "fast", projectName: "Fast", velocity: 2.0 }),
    ];
    render(<VelocityComparisonTable sprints={sprints} />);

    // Default: desc — Fast first
    let rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Fast");

    // Click Velocity header to toggle to asc
    fireEvent.click(screen.getByText(/Velocity/));
    rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Slow");

    // Click again to toggle back to desc
    fireEvent.click(screen.getByText(/Velocity/));
    rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Fast");
  });

  it("clicking project column header sorts by project name", () => {
    const sprints = [
      createMockSprint({ projectId: "b", projectName: "Beta", velocity: 2.0 }),
      createMockSprint({ projectId: "a", projectName: "Alpha", velocity: 0.5 }),
    ];
    render(<VelocityComparisonTable sprints={sprints} />);

    // Click Project header — default asc
    fireEvent.click(screen.getByText(/Project/));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha");
    expect(rows[1]).toHaveTextContent("Beta");
  });

  it("renders progress column", () => {
    const sprints = [createMockSprint({ projectId: "a", progressPercent: 75 })];
    render(<VelocityComparisonTable sprints={sprints} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("clicking progress column header sorts by progress percent", () => {
    const sprints = [
      createMockSprint({
        projectId: "low",
        projectName: "Low Progress",
        velocity: 1.0,
        progressPercent: 30,
      }),
      createMockSprint({
        projectId: "high",
        projectName: "High Progress",
        velocity: 0.5,
        progressPercent: 90,
      }),
    ];
    render(<VelocityComparisonTable sprints={sprints} />);

    // Click Progress header — default desc
    fireEvent.click(screen.getByRole("columnheader", { name: /Progress/ }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("High Progress");
    expect(rows[1]).toHaveTextContent("Low Progress");
  });

  it("has accessible table label", () => {
    const sprints = [createMockSprint()];
    render(<VelocityComparisonTable sprints={sprints} />);
    expect(
      screen.getByRole("table", { name: "Velocity comparison across projects" }),
    ).toBeInTheDocument();
  });
});
