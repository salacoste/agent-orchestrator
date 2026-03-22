/**
 * OwnerBadge component tests (Story 42.2).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnerBadge } from "../OwnerBadge";

describe("OwnerBadge", () => {
  it("renders owner name when assigned", () => {
    render(<OwnerBadge owner="Alice" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders 'Unassigned' when no owner", () => {
    render(<OwnerBadge owner={null} />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("applies blue styling for assigned owner", () => {
    render(<OwnerBadge owner="Bob" />);
    const badge = screen.getByTestId("owner-badge");
    expect(badge.className).toContain("blue");
  });

  it("applies muted styling for unassigned", () => {
    render(<OwnerBadge owner={null} />);
    const badge = screen.getByTestId("owner-badge");
    expect(badge.className).toContain("muted");
  });
});
