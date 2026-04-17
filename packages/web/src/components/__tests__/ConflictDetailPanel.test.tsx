import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConflictDetailPanel } from "../ConflictDetailPanel";
import type { ResourceConflict } from "@composio/ao-core";

const mockConflict: ResourceConflict = {
  id: "conflict-abc123",
  resourceType: "repository",
  resourceIdentifier: "github.com/org/shared-repo",
  competingProjects: ["proj-alpha", "proj-beta"],
  severity: "high",
  detectedAt: "2026-04-01T12:00:00.000Z",
  metadata: { competingCount: 2 },
};

describe("ConflictDetailPanel", () => {
  it("renders all conflict fields", () => {
    render(<ConflictDetailPanel conflict={mockConflict} onClose={vi.fn()} />);

    expect(screen.getByText("Conflict Details")).toBeDefined();
    expect(screen.getByText("Repository")).toBeDefined();
    expect(screen.getByText("github.com/org/shared-repo")).toBeDefined();
    expect(screen.getByText("proj-alpha")).toBeDefined();
    expect(screen.getByText("proj-beta")).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
    // Metadata is rendered as key: value pairs
    expect(screen.getByText("competingCount:")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ConflictDetailPanel conflict={mockConflict} onClose={onClose} />);

    const closeButton = screen.getByLabelText("Close detail panel");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<ConflictDetailPanel conflict={mockConflict} onClose={onClose} />);

    // The outermost fixed div has the backdrop click handler
    const panel = screen.getByText("Conflict Details").closest(".fixed")!;
    fireEvent.click(panel);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ConflictDetailPanel conflict={mockConflict} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close on non-Escape key", () => {
    const onClose = vi.fn();
    render(<ConflictDetailPanel conflict={mockConflict} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows competing projects count in label", () => {
    render(<ConflictDetailPanel conflict={mockConflict} onClose={vi.fn()} />);
    expect(screen.getByText(/Competing Projects/)).toBeDefined();
  });
});
