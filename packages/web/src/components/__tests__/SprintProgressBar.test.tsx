import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SprintProgressBar } from "../SprintProgressBar";
import type { SprintHealthStatus } from "@/lib/types";

interface StoryBreakdown {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  backlog: number;
}

function createProps(
  overrides: {
    progressPercent?: number;
    health?: SprintHealthStatus;
    stories?: Partial<StoryBreakdown>;
  } = {},
) {
  return {
    progressPercent: overrides.progressPercent ?? 50,
    health: (overrides.health ?? "on-track") as SprintHealthStatus,
    stories: {
      total: 10,
      done: 5,
      inProgress: 3,
      blocked: 0,
      backlog: 2,
      ...overrides.stories,
    },
    projectName: "Test Project",
  };
}

describe("SprintProgressBar", () => {
  it("renders progress bar with correct width style", () => {
    render(<SprintProgressBar {...createProps({ progressPercent: 72 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveStyle({ width: "72%" });
  });

  it("applies green color for on-track health", () => {
    render(<SprintProgressBar {...createProps({ health: "on-track" })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.className).toContain("bg-[var(--color-success)]");
  });

  it("applies yellow color for at-risk health", () => {
    render(<SprintProgressBar {...createProps({ health: "at-risk" })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.className).toContain("bg-[var(--color-warning)]");
  });

  it("applies red color for blocked health", () => {
    render(<SprintProgressBar {...createProps({ health: "blocked" })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.className).toContain("bg-[var(--color-error)]");
  });

  it("title tooltip contains detailed breakdown text", () => {
    render(
      <SprintProgressBar
        {...createProps({
          progressPercent: 50,
          stories: { total: 18, done: 9, inProgress: 5, blocked: 2, backlog: 2 },
        })}
      />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("title");
    const title = bar.getAttribute("title")!;
    expect(title).toContain("9 done / 18 total (50%)");
    expect(title).toContain("5 in-progress");
    expect(title).toContain("2 blocked");
    expect(title).toContain("2 backlog");
  });

  it("renders with aria progressbar role and correct aria values", () => {
    render(<SprintProgressBar {...createProps({ progressPercent: 65 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "65");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-label", "Test Project sprint progress");
  });

  it("handles 0% progress (empty bar)", () => {
    render(<SprintProgressBar {...createProps({ progressPercent: 0 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveStyle({ width: "0%" });
  });

  it("handles 100% progress (full bar)", () => {
    render(<SprintProgressBar {...createProps({ progressPercent: 100 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveStyle({ width: "100%" });
  });

  it("clamps progressPercent > 100 to 100%", () => {
    render(<SprintProgressBar {...createProps({ progressPercent: 150 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveStyle({ width: "100%" });
  });

  it("clamps negative progressPercent to 0%", () => {
    render(<SprintProgressBar {...createProps({ progressPercent: -10 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveStyle({ width: "0%" });
  });

  it("renders percentage text label", () => {
    render(<SprintProgressBar {...createProps({ progressPercent: 72 })} />);
    expect(screen.getByText("72%")).toBeInTheDocument();
  });
});
