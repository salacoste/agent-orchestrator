import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SprintCostPanel } from "../SprintCostPanel";

describe("SprintCostPanel", () => {
  it("renders empty state when no data", () => {
    render(<SprintCostPanel cost={null} clock={null} />);
    expect(screen.getByText("No cost or schedule data available.")).toBeInTheDocument();
  });

  it("renders cost summary with token count and burn rate", () => {
    render(
      <SprintCostPanel
        cost={{
          totalTokens: 50000,
          totalAgents: 3,
          burnRate: 600,
          projectedCost: 0,
          runawayAgents: [],
        }}
        clock={null}
      />,
    );
    expect(screen.getByTestId("cost-summary")).toBeInTheDocument();
    expect(screen.getByText("50,000")).toBeInTheDocument();
    expect(screen.getByText("600/min")).toBeInTheDocument();
  });

  it("shows runaway agent warning", () => {
    render(
      <SprintCostPanel
        cost={{
          totalTokens: 100000,
          totalAgents: 4,
          burnRate: 1000,
          projectedCost: 0,
          runawayAgents: ["agent-3"],
        }}
        clock={null}
      />,
    );
    expect(screen.getByTestId("runaway-warning")).toBeInTheDocument();
    expect(screen.getByText(/agent-3/)).toBeInTheDocument();
  });

  it("renders sprint clock with on-track status", () => {
    render(
      <SprintCostPanel
        cost={null}
        clock={{
          timeRemainingMs: 172800000,
          workRemainingMs: 100000000,
          gapMs: -72800000,
          status: "on-track",
          description: "Sprint ends in 48h. Remaining work: 28h. On track",
        }}
      />,
    );
    const clock = screen.getByTestId("sprint-clock");
    expect(clock).toBeInTheDocument();
    expect(clock.textContent).toContain("On track");
    expect(clock.className).toContain("green");
  });

  it("renders sprint clock with behind status in red", () => {
    render(
      <SprintCostPanel
        cost={null}
        clock={{
          timeRemainingMs: 7200000,
          workRemainingMs: 36000000,
          gapMs: 28800000,
          status: "behind",
          description: "Sprint ends in 2h. Remaining work: 10h. BEHIND by 8h",
        }}
      />,
    );
    const clock = screen.getByTestId("sprint-clock");
    expect(clock.className).toContain("red");
    expect(clock.textContent).toContain("BEHIND");
  });

  it("has accessible section label", () => {
    render(<SprintCostPanel cost={null} clock={null} />);
    expect(screen.getByRole("region", { name: "Sprint cost and schedule" })).toBeInTheDocument();
  });
});
