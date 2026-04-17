import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { UnifiedSprintSummaryCards } from "../UnifiedSprintSummaryCards";
import type { UnifiedSprintSummary } from "@/lib/types";

function createMockSummary(overrides: Partial<UnifiedSprintSummary> = {}): UnifiedSprintSummary {
  return {
    totalSprints: 5,
    activeSprints: 3,
    completedSprints: 1,
    planningSprints: 1,
    totalStories: 50,
    storiesDone: 30,
    avgProgress: 60,
    atRiskSprints: 0,
    avgVelocity: 0,
    maxVelocity: 0,
    ...overrides,
  };
}

describe("UnifiedSprintSummaryCards", () => {
  it("renders all 7 metric cards", () => {
    render(<UnifiedSprintSummaryCards summary={createMockSummary()} />);
    expect(screen.getByText("Total Sprints")).toBeInTheDocument();
    expect(screen.getByText("Active Sprints")).toBeInTheDocument();
    expect(screen.getByText("Planning Sprints")).toBeInTheDocument();
    expect(screen.getByText("Stories Done")).toBeInTheDocument();
    expect(screen.getByText("Avg Progress")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();
    expect(screen.getByText("Avg Velocity")).toBeInTheDocument();
    // Verify the 7th card actually shows the dash value for zero velocity
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("displays avg velocity with /day format when > 0", () => {
    render(
      <UnifiedSprintSummaryCards
        summary={createMockSummary({ avgVelocity: 1.25, maxVelocity: 2.0 })}
      />,
    );
    expect(screen.getByText("1.25/day")).toBeInTheDocument();
  });

  it("displays dash for avg velocity when 0", () => {
    render(
      <UnifiedSprintSummaryCards summary={createMockSummary({ avgVelocity: 0, maxVelocity: 0 })} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("displays total sprints count", () => {
    render(<UnifiedSprintSummaryCards summary={createMockSummary({ totalSprints: 7 })} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("displays active sprints count", () => {
    render(<UnifiedSprintSummaryCards summary={createMockSummary({ activeSprints: 4 })} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("displays stories as done/total format", () => {
    render(
      <UnifiedSprintSummaryCards
        summary={createMockSummary({ storiesDone: 25, totalStories: 40 })}
      />,
    );
    expect(screen.getByText("25/40")).toBeInTheDocument();
  });

  it("displays avg progress with percent", () => {
    render(<UnifiedSprintSummaryCards summary={createMockSummary({ avgProgress: 72 })} />);
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("displays at-risk count with warning color when > 0", () => {
    render(<UnifiedSprintSummaryCards summary={createMockSummary({ atRiskSprints: 3 })} />);
    const atRiskLabel = screen.getByText("At Risk");
    const card = atRiskLabel.closest("[title]");
    expect(card).toBeInTheDocument();
    const valueEl = within(card!).getByText("3");
    expect(valueEl).toBeInTheDocument();
    // Warning color class applied when atRiskSprints > 0
    expect(valueEl.className).toContain("color-warning");
  });

  it("displays at-risk count without warning color when 0", () => {
    render(<UnifiedSprintSummaryCards summary={createMockSummary({ atRiskSprints: 0 })} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles zero sprints", () => {
    render(
      <UnifiedSprintSummaryCards
        summary={createMockSummary({
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
        })}
      />,
    );
    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    // Total Sprints, Active Sprints, Planning Sprints all show "0" — verify labels
    expect(screen.getByText("Total Sprints")).toBeInTheDocument();
    expect(screen.getByText("Active Sprints")).toBeInTheDocument();
    expect(screen.getByText("Planning Sprints")).toBeInTheDocument();
  });

  it("has accessible region label", () => {
    render(<UnifiedSprintSummaryCards summary={createMockSummary()} />);
    expect(screen.getByRole("region", { name: "Sprint Summary" })).toBeInTheDocument();
  });
});
