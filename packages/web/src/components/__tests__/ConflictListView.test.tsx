import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConflictListView } from "../ConflictListView";
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

describe("ConflictListView", () => {
  it("shows 'no conflicts' when list is empty", () => {
    render(<ConflictListView conflicts={[]} onSelectConflict={vi.fn()} />);
    expect(screen.getByText("No conflicts detected")).toBeDefined();
  });

  it("renders conflict items with severity badge and resource identifier", () => {
    const conflicts = [
      makeConflict({ id: "c1", resourceIdentifier: "github.com/org/repo-a" }),
      makeConflict({ id: "c2", resourceIdentifier: "github.com/org/repo-b", severity: "critical" }),
    ];
    render(<ConflictListView conflicts={conflicts} onSelectConflict={vi.fn()} />);
    expect(screen.getByText("github.com/org/repo-a")).toBeDefined();
    expect(screen.getByText("github.com/org/repo-b")).toBeDefined();
    // Severity badges appear in both the list items and filter dropdowns
    expect(screen.getAllByText("Critical").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSelectConflict when a conflict is clicked", () => {
    const conflict = makeConflict({ id: "c1" });
    const onSelect = vi.fn();
    render(<ConflictListView conflicts={[conflict]} onSelectConflict={onSelect} />);
    fireEvent.click(screen.getByText("github.com/org/repo"));
    expect(onSelect).toHaveBeenCalledWith(conflict);
  });

  it("filters by resource type", () => {
    const conflicts = [
      makeConflict({
        id: "c1",
        resourceType: "repository",
        resourceIdentifier: "github.com/org/repo",
      }),
      makeConflict({ id: "c2", resourceType: "agent", resourceIdentifier: "shared-pool" }),
    ];
    render(<ConflictListView conflicts={conflicts} onSelectConflict={vi.fn()} />);

    // Select "agent" filter
    const select = screen.getByLabelText("Filter by resource type");
    fireEvent.change(select, { target: { value: "agent" } });

    // Repository resource identifier should be gone
    expect(screen.queryByText("github.com/org/repo")).toBeNull();
    // Agent resource identifier should still be visible
    expect(screen.getByText("shared-pool")).toBeDefined();
  });

  it("filters by severity", () => {
    const conflicts = [
      makeConflict({ id: "c1", severity: "high", resourceIdentifier: "github.com/org/high-repo" }),
      makeConflict({ id: "c2", severity: "low", resourceIdentifier: "github.com/org/low-repo" }),
    ];
    render(<ConflictListView conflicts={conflicts} onSelectConflict={vi.fn()} />);

    // Select "low" severity filter
    const select = screen.getByLabelText("Filter by severity");
    fireEvent.change(select, { target: { value: "low" } });

    // High-severity resource should be filtered out
    expect(screen.queryByText("github.com/org/high-repo")).toBeNull();
    // Low-severity resource should still be visible
    expect(screen.getByText("github.com/org/low-repo")).toBeDefined();
  });

  it("shows 'New' badge for SSE-arrived conflicts", () => {
    const conflict = makeConflict({ id: "c-new" });
    const newIds = new Set(["c-new"]);
    render(
      <ConflictListView
        conflicts={[conflict]}
        onSelectConflict={vi.fn()}
        newConflictIds={newIds}
      />,
    );
    expect(screen.getByText("New")).toBeDefined();
  });

  it("shows competing project count", () => {
    const conflict = makeConflict({
      id: "c1",
      competingProjects: ["proj-a", "proj-b", "proj-c"],
    });
    render(<ConflictListView conflicts={[conflict]} onSelectConflict={vi.fn()} />);
    expect(screen.getByText("3 competing projects")).toBeDefined();
  });

  it("shows selected state for selected conflict", () => {
    const conflict = makeConflict({ id: "c1" });
    render(
      <ConflictListView
        conflicts={[conflict]}
        onSelectConflict={vi.fn()}
        selectedConflictId="c1"
      />,
    );
    // The button should have the selected ring class
    const button = screen.getByRole("button");
    expect(button.className).toContain("ring-2");
  });
});
