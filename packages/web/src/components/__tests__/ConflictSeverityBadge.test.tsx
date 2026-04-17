import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConflictSeverityBadge } from "../ConflictSeverityBadge";

describe("ConflictSeverityBadge", () => {
  it("renders critical severity with red styles", () => {
    render(<ConflictSeverityBadge severity="critical" />);
    const badge = screen.getByText("Critical");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("bg-red");
  });

  it("renders high severity with orange styles", () => {
    render(<ConflictSeverityBadge severity="high" />);
    const badge = screen.getByText("High");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("bg-orange");
  });

  it("renders medium severity with yellow styles", () => {
    render(<ConflictSeverityBadge severity="medium" />);
    const badge = screen.getByText("Medium");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("bg-yellow");
  });

  it("renders low severity with green styles", () => {
    render(<ConflictSeverityBadge severity="low" />);
    const badge = screen.getByText("Low");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("bg-green");
  });
});
