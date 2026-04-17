import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConflictSummaryCards } from "../ConflictSummaryCards";
import type { ResourceConflict } from "@composio/ao-core";

function makeConflict(overrides: Partial<ResourceConflict> = {}): ResourceConflict {
  return {
    id: "conflict-test",
    resourceType: "repository",
    resourceIdentifier: "github.com/org/repo",
    competingProjects: ["proj-a", "proj-b"],
    severity: "high",
    detectedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

describe("ConflictSummaryCards", () => {
  it("shows zero conflicts when empty", () => {
    render(<ConflictSummaryCards conflicts={[]} />);
    // Two "0" values: Total Conflicts and Critical/High
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("No conflicts").length).toBeGreaterThanOrEqual(1);
  });

  it("shows total conflict count", () => {
    const conflicts = [
      makeConflict({ id: "c1" }),
      makeConflict({ id: "c2" }),
      makeConflict({ id: "c3" }),
    ];
    render(<ConflictSummaryCards conflicts={conflicts} />);
    // "Total Conflicts" card shows 3
    const labels = screen.getAllByText("3");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows critical/high count", () => {
    const conflicts = [
      makeConflict({ id: "c1", severity: "critical" }),
      makeConflict({ id: "c2", severity: "high" }),
      makeConflict({ id: "c3", severity: "low" }),
    ];
    render(<ConflictSummaryCards conflicts={conflicts} />);
    // Critical / High = 2
    expect(screen.getByText("2")).toBeDefined();
  });

  it("renders severity breakdown", () => {
    const conflicts = [
      makeConflict({ id: "c1", severity: "critical" }),
      makeConflict({ id: "c2", severity: "low" }),
    ];
    render(<ConflictSummaryCards conflicts={conflicts} />);
    expect(screen.getByText("By Severity")).toBeDefined();
  });

  it("renders resource type breakdown", () => {
    const conflicts = [
      makeConflict({ id: "c1", resourceType: "repository" }),
      makeConflict({ id: "c2", resourceType: "agent" }),
    ];
    render(<ConflictSummaryCards conflicts={conflicts} />);
    expect(screen.getByText("By Resource Type")).toBeDefined();
  });
});
