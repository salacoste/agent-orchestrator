import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortfolioMetricsWidget } from "../PortfolioMetricsWidget.js";
import type { PortfolioMetrics } from "@/lib/types";

function createMockMetrics(overrides: Partial<PortfolioMetrics> = {}): PortfolioMetrics {
  return {
    totalAgents: 5,
    totalConfiguredAgents: 8,
    stories: {
      backlog: 10,
      inProgress: 3,
      done: 7,
      blocked: 2,
      total: 22,
    },
    sprintHealthScore: 75,
    utilizationPercent: 62,
    ...overrides,
  };
}

describe("PortfolioMetricsWidget", () => {
  it("renders all four metric cards", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics()} />);

    expect(screen.getByText("Total Agents")).toBeInTheDocument();
    expect(screen.getByText("Stories")).toBeInTheDocument();
    expect(screen.getByText("Sprint Health")).toBeInTheDocument();
    expect(screen.getByText("Utilization")).toBeInTheDocument();
  });

  it("displays total agents count", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics({ totalAgents: 12 })} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("displays stories as done/total format", () => {
    render(
      <PortfolioMetricsWidget
        metrics={createMockMetrics({
          stories: { backlog: 5, inProgress: 2, done: 8, blocked: 1, total: 16 },
        })}
      />,
    );
    expect(screen.getByText("8/16")).toBeInTheDocument();
  });

  it("displays sprint health score with percentage", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics({ sprintHealthScore: 85 })} />);
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("displays utilization percentage", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics({ utilizationPercent: 45 })} />);
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("has tooltips on metric cards", () => {
    const { container } = render(<PortfolioMetricsWidget metrics={createMockMetrics()} />);

    // Find metric cards by their parent div with title attribute
    const cardsWithTitle = container.querySelectorAll("div[title]");
    expect(cardsWithTitle.length).toBe(4);
  });

  it("shows healthy (green) color for score >= 80", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics({ sprintHealthScore: 85 })} />);
    const healthValue = screen.getByText("85%");
    expect(healthValue.className).toContain("text-[var(--color-success)]");
  });

  it("shows warning (yellow) color for score 60-79", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics({ sprintHealthScore: 65 })} />);
    const healthValue = screen.getByText("65%");
    expect(healthValue.className).toContain("text-[var(--color-warning)]");
  });

  it("shows error (red) color for score < 60", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics({ sprintHealthScore: 45 })} />);
    const healthValue = screen.getByText("45%");
    expect(healthValue.className).toContain("text-[var(--color-error)]");
  });

  it("handles zero values gracefully", () => {
    render(
      <PortfolioMetricsWidget
        metrics={{
          totalAgents: 0,
          totalConfiguredAgents: 0,
          stories: { backlog: 0, inProgress: 0, done: 0, blocked: 0, total: 0 },
          sprintHealthScore: 0,
          utilizationPercent: 0,
        }}
      />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("0/0")).toBeInTheDocument();
    // Both Sprint Health and Utilization show 0%, so use getAllByText
    expect(screen.getAllByText("0%").length).toBe(2);
  });

  it("has responsive grid classes", () => {
    const { container } = render(<PortfolioMetricsWidget metrics={createMockMetrics()} />);
    const grid = container.querySelector('[role="region"]');

    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
    expect(grid).toHaveClass("md:grid-cols-4");
  });

  it("has accessible region label", () => {
    render(<PortfolioMetricsWidget metrics={createMockMetrics()} />);
    expect(screen.getByRole("region", { name: "Portfolio Metrics" })).toBeInTheDocument();
  });

  it("tooltip includes detailed story breakdown", () => {
    const { container } = render(
      <PortfolioMetricsWidget
        metrics={createMockMetrics({
          stories: { backlog: 10, inProgress: 5, done: 8, blocked: 2, total: 25 },
        })}
      />,
    );

    // Find the Stories card by looking for the card containing "Stories" text
    const cards = container.querySelectorAll("div[title]");
    let storiesCard: Element | null = null;
    for (const card of cards) {
      if (card.textContent?.includes("Stories")) {
        storiesCard = card;
        break;
      }
    }

    const tooltip = storiesCard?.getAttribute("title");
    expect(tooltip).toContain("Backlog: 10");
    expect(tooltip).toContain("In Progress: 5");
    expect(tooltip).toContain("Done: 8");
    expect(tooltip).toContain("Blocked: 2");
  });
});
