import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConflictPatternSummary } from "../ConflictPatternSummary";
import type { ConflictPatternSummary as PatternSummaryType } from "@composio/ao-core";

const mockPatterns: PatternSummaryType = {
  totalResolved: 24,
  byResourceType: { repository: 15, agent: 9 },
  byOutcome: { resolved: 18, "auto-resolved": 4, dismissed: 2 },
  byStrategy: { "sequential-scheduling": 10, "agent-reassignment": 8 },
  mostConflictedResource: "org/shared-repo",
  avgResolutionTimeMs: 9_000_000,
  recurringConflicts: [
    { resourceIdentifier: "org/shared-repo", count: 5 },
    { resourceIdentifier: "shared-pool", count: 3 },
  ],
};

describe("ConflictPatternSummary", () => {
  it("renders nothing when patterns is null", () => {
    const { container } = render(<ConflictPatternSummary patterns={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders total resolved count", () => {
    render(<ConflictPatternSummary patterns={mockPatterns} />);
    expect(screen.getByText("Total Resolved")).toBeDefined();
    expect(screen.getByText("24")).toBeDefined();
  });

  it("renders average resolution time", () => {
    render(<ConflictPatternSummary patterns={mockPatterns} />);
    // 9_000_000 ms = 2h 30m
    expect(screen.getByText("2h 30m")).toBeDefined();
  });

  it("renders most conflicted resource", () => {
    render(<ConflictPatternSummary patterns={mockPatterns} />);
    expect(screen.getByText("Most Conflicted Resource")).toBeDefined();
    // Resource name appears in card + recurring list — use getAllByText
    const matches = screen.getAllByText("org/shared-repo");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders recurring conflicts", () => {
    render(<ConflictPatternSummary patterns={mockPatterns} />);
    expect(screen.getByText("Recurring Conflicts")).toBeDefined();
    expect(screen.getByText(/5x/)).toBeDefined();
    expect(screen.getByText(/3x/)).toBeDefined();
  });

  it("shows N/A for zero resolution time", () => {
    const patterns = { ...mockPatterns, avgResolutionTimeMs: 0 };
    render(<ConflictPatternSummary patterns={patterns} />);
    expect(screen.getByText("N/A")).toBeDefined();
  });

  it("shows None when no recurring conflicts", () => {
    const patterns = { ...mockPatterns, recurringConflicts: [] };
    render(<ConflictPatternSummary patterns={patterns} />);
    expect(screen.getByText("None")).toBeDefined();
  });
});
