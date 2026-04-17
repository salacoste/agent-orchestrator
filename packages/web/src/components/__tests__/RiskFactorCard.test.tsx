import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RiskFactorCard } from "../RiskDashboard.js";
import type { RiskFactor, RiskFactorType } from "@/lib/risk-aggregation";

const baseFactor: RiskFactor = {
  id: "test-factor",
  type: "resource-bottleneck" as RiskFactorType,
  title: "Test Factor",
  severity: 80,
  severityLabel: "critical",
  trend: "stable",
  affectedProjects: ["project-a"],
  contributingFactors: ["Low capacity"],
  affectedStories: [],
  suggestedAction: "Rebalance workload",
};

const multiProject: RiskFactor = {
  ...baseFactor,
  affectedProjects: ["project-a", "project-b"],
};

describe("RiskFactorCard", () => {
  it("renders factor title and severity", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/Test Factor/)).toBeInTheDocument();
    expect(screen.getByText("Severity: 80")).toBeInTheDocument();
  });

  it("renders type label", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("resource-bottleneck")).toBeInTheDocument();
  });

  it("renders project count singular", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("1 project")).toBeInTheDocument();
  });

  it("shows plural for multiple affected projects", () => {
    render(<RiskFactorCard factor={multiProject} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("2 projects")).toBeInTheDocument();
  });

  it("shows expand arrow when collapsed", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("▶")).toBeInTheDocument();
  });

  it("shows collapse arrow when expanded", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={true} onToggle={vi.fn()} />);
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("shows contributing factors when expanded", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={true} onToggle={vi.fn()} />);
    expect(screen.getByText("Contributing Factors:")).toBeInTheDocument();
    expect(screen.getByText(/Low capacity/)).toBeInTheDocument();
  });

  it("shows suggested action when expanded", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={true} onToggle={vi.fn()} />);
    expect(screen.getByText("Rebalance workload")).toBeInTheDocument();
  });

  it("does not show detail section when collapsed", () => {
    render(<RiskFactorCard factor={baseFactor} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("Contributing Factors:")).not.toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<RiskFactorCard factor={baseFactor} isExpanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders trend indicator for worsening", () => {
    const worsening: RiskFactor = { ...baseFactor, trend: "worsening" };
    render(<RiskFactorCard factor={worsening} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it("renders trend indicator for improving", () => {
    const improving: RiskFactor = { ...baseFactor, trend: "improving" };
    render(<RiskFactorCard factor={improving} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it("hides contributing factors section when empty", () => {
    const noFactors: RiskFactor = { ...baseFactor, contributingFactors: [] };
    render(<RiskFactorCard factor={noFactors} isExpanded={true} onToggle={vi.fn()} />);
    expect(screen.queryByText("Contributing Factors:")).not.toBeInTheDocument();
  });

  it("hides affected stories section when empty", () => {
    const noStories: RiskFactor = { ...baseFactor, affectedStories: [] };
    render(<RiskFactorCard factor={noStories} isExpanded={true} onToggle={vi.fn()} />);
    expect(screen.queryByText("Affected Stories:")).not.toBeInTheDocument();
  });
});
