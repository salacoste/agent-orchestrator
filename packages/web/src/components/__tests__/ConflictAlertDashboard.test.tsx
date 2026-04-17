import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ConflictAlertDashboard } from "../ConflictAlertDashboard";
import type { ResourceConflict } from "@composio/ao-core";

// Capture the SSE callback so we can fire it manually in tests
let capturedSSECallback: ((conflicts: ResourceConflict[]) => void) | null = null;

vi.mock("@/hooks/useConflictSSE", () => ({
  useConflictSSE: vi.fn((cb: (conflicts: ResourceConflict[]) => void) => {
    capturedSSECallback = cb;
  }),
}));

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

describe("ConflictAlertDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSSECallback = null;
  });

  it("renders header and summary cards with initial conflicts", () => {
    const conflicts = [
      makeConflict({ id: "c1", severity: "critical" }),
      makeConflict({ id: "c2", severity: "low" }),
    ];
    render(<ConflictAlertDashboard initialConflicts={conflicts} scanDurationMs={5.2} />);

    expect(screen.getByText("Resource Conflicts")).toBeDefined();
    expect(screen.getByText(/scan: 5ms/)).toBeDefined();
    expect(screen.getByText("By Severity")).toBeDefined();
  });

  it("renders conflict list with initial data", () => {
    const conflicts = [makeConflict({ id: "c1", resourceIdentifier: "github.com/org/repo-x" })];
    render(<ConflictAlertDashboard initialConflicts={conflicts} scanDurationMs={0} />);

    expect(screen.getByText("github.com/org/repo-x")).toBeDefined();
  });

  it("renders empty state when no conflicts", () => {
    render(<ConflictAlertDashboard initialConflicts={[]} scanDurationMs={0} />);
    expect(screen.getByText("No conflicts detected")).toBeDefined();
  });

  it("merges new conflicts received via SSE callback", () => {
    render(<ConflictAlertDashboard initialConflicts={[]} scanDurationMs={0} />);
    expect(screen.getByText("No conflicts detected")).toBeDefined();

    // Simulate SSE delivering a new conflict
    const newConflict = makeConflict({
      id: "sse-1",
      resourceIdentifier: "github.com/org/new-repo",
    });
    act(() => {
      capturedSSECallback!([newConflict]);
    });

    // The new conflict should appear in the list
    expect(screen.getByText("github.com/org/new-repo")).toBeDefined();
    expect(screen.queryByText("No conflicts detected")).toBeNull();
  });

  it("does not duplicate conflicts already in the list", () => {
    const existing = makeConflict({ id: "c1", resourceIdentifier: "github.com/org/repo" });
    render(<ConflictAlertDashboard initialConflicts={[existing]} scanDurationMs={0} />);

    // SSE sends the same conflict again
    act(() => {
      capturedSSECallback!([existing]);
    });

    // Should still show only 1 conflict (no duplicate)
    expect(screen.getAllByText("github.com/org/repo").length).toBe(1);
  });

  it("shows 'New' badge for SSE-arrived conflicts", () => {
    render(<ConflictAlertDashboard initialConflicts={[]} scanDurationMs={0} />);

    const newConflict = makeConflict({ id: "sse-new" });
    act(() => {
      capturedSSECallback!([newConflict]);
    });

    expect(screen.getByText("New")).toBeDefined();
  });
});
