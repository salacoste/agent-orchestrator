import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SprintCard } from "../SprintCard";
import type { UnifiedSprintEntry } from "@/lib/types";

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

describe("SprintCard", () => {
  it("renders project name", () => {
    render(<SprintCard sprint={createMockSprint({ projectName: "Web Platform" })} />);
    expect(screen.getByText("Web Platform")).toBeInTheDocument();
  });

  it("renders sprint name", () => {
    render(<SprintCard sprint={createMockSprint({ sprintName: "Sprint 12" })} />);
    expect(screen.getByText("Sprint 12")).toBeInTheDocument();
  });

  it("renders health indicator", () => {
    render(<SprintCard sprint={createMockSprint({ health: "on-track" })} />);
    expect(screen.getByText("On Track")).toBeInTheDocument();
  });

  it("renders at-risk health badge", () => {
    render(<SprintCard sprint={createMockSprint({ health: "at-risk" })} />);
    expect(screen.getByText("At Risk")).toBeInTheDocument();
  });

  it("renders blocked health badge", () => {
    render(<SprintCard sprint={createMockSprint({ health: "blocked" })} />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("renders progress percentage", () => {
    render(<SprintCard sprint={createMockSprint({ progressPercent: 72 })} />);
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("renders progress bar with correct aria", () => {
    render(<SprintCard sprint={createMockSprint({ progressPercent: 50 })} />);
    const bar = screen.getByRole("progressbar", { name: /Project A sprint progress/i });
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders story breakdown", () => {
    render(
      <SprintCard
        sprint={createMockSprint({
          stories: { total: 15, done: 8, inProgress: 4, blocked: 1, backlog: 2 },
        })}
      />,
    );
    expect(screen.getByText("15 total")).toBeInTheDocument();
    expect(screen.getByText("8 done")).toBeInTheDocument();
    expect(screen.getByText("4 active")).toBeInTheDocument();
    expect(screen.getByText("1 blocked")).toBeInTheDocument();
  });

  it("hides in-progress when zero", () => {
    render(
      <SprintCard
        sprint={createMockSprint({
          stories: { total: 5, done: 5, inProgress: 0, blocked: 0, backlog: 0 },
        })}
      />,
    );
    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
  });

  it("hides blocked when zero", () => {
    render(
      <SprintCard
        sprint={createMockSprint({
          stories: { total: 5, done: 3, inProgress: 2, blocked: 0, backlog: 0 },
        })}
      />,
    );
    expect(screen.queryByText(/blocked/i)).not.toBeInTheDocument();
  });

  it("renders date range when available", () => {
    render(
      <SprintCard
        sprint={createMockSprint({
          startDate: "2026-03-15",
          endDate: "2026-03-28",
        })}
      />,
    );
    expect(screen.getByText(/Mar 15/)).toBeInTheDocument();
    expect(screen.getByText(/Mar 28/)).toBeInTheDocument();
  });

  it("does not render date section when both null", () => {
    render(<SprintCard sprint={createMockSprint({ startDate: null, endDate: null })} />);
    // The " — " separator only appears in the date section
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  // --- Story 53.3: At-Risk Sprint Identification ---

  it("renders health reasons when present", () => {
    render(
      <SprintCard
        sprint={createMockSprint({
          health: "blocked",
          healthReasons: ["More blocked stories (4) than in-progress (2)"],
        })}
      />,
    );
    expect(screen.getByText("More blocked stories (4) than in-progress (2)")).toBeInTheDocument();
  });

  it("hides health reasons when array is empty", () => {
    render(<SprintCard sprint={createMockSprint({ health: "on-track", healthReasons: [] })} />);
    // No detail section rendered
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows risk detail collapsed by default for at-risk sprint", () => {
    const { container } = render(
      <SprintCard
        sprint={createMockSprint({
          health: "at-risk",
          healthReasons: ["More blocked stories (3) than in-progress (1)"],
        })}
      />,
    );
    // Detail section not rendered when collapsed
    expect(container.querySelector("ul")).toBeNull();
  });

  it("shows risk detail expanded by default for blocked sprint", () => {
    render(
      <SprintCard
        sprint={createMockSprint({
          health: "blocked",
          healthReasons: ["All 5 active stories are blocked"],
        })}
      />,
    );
    expect(screen.getByText("All 5 active stories are blocked")).toBeInTheDocument();
  });

  it("toggles detail section on badge click", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(
      <SprintCard
        sprint={createMockSprint({
          health: "at-risk",
          healthReasons: ["More blocked stories (3) than in-progress (1)"],
        })}
      />,
    );

    // Initially collapsed
    expect(screen.queryByText(/More blocked/)).not.toBeInTheDocument();

    // Click badge to expand
    const badge = screen.getByRole("button", { name: /At Risk/i });
    await user.click(badge);
    expect(screen.getByText(/More blocked/)).toBeInTheDocument();

    // Click again to collapse
    await user.click(badge);
    expect(screen.queryByText(/More blocked/)).not.toBeInTheDocument();
  });
});
