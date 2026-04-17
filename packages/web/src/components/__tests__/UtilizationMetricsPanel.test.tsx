import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UtilizationMetricsPanel } from "../UtilizationMetricsPanel.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockProjects = [
  { id: "p1", name: "Project 1" },
  { id: "p2", name: "Project 2" },
];

const mockOverview = {
  projectSummaries: [
    {
      projectId: "p1",
      avgUtilization: 65,
      overutilizedCount: 1,
      underutilizedCount: 0,
      agentCount: 3,
      agentSnapshots: [],
    },
    {
      projectId: "p2",
      avgUtilization: 40,
      overutilizedCount: 0,
      underutilizedCount: 1,
      agentCount: 2,
      agentSnapshots: [],
    },
  ],
  totalAgents: 5,
  avgUtilization: 50,
  overutilizedAgents: 1,
  underutilizedAgents: 1,
  timestamp: Date.now(),
};

describe("UtilizationMetricsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOverview),
    });
  });

  it("renders heading after loading", async () => {
    render(<UtilizationMetricsPanel projects={mockProjects} />);
    await screen.findByText("Resource Utilization");
  });

  it("renders project filter when multiple projects", async () => {
    render(<UtilizationMetricsPanel projects={mockProjects} />);
    await screen.findByText("Resource Utilization");
    expect(screen.getByLabelText("Filter by project")).toBeTruthy();
  });

  it("does not render project filter for single project", async () => {
    render(<UtilizationMetricsPanel projects={[{ id: "p1", name: "Only" }]} />);
    await screen.findByText("Resource Utilization");
    expect(screen.queryByLabelText("Filter by project")).toBeNull();
  });

  it("renders time window selector", async () => {
    render(<UtilizationMetricsPanel projects={mockProjects} />);
    await screen.findByText("Resource Utilization");
    expect(screen.getByLabelText("Time window")).toBeTruthy();
  });

  it("displays portfolio metrics after fetch", async () => {
    render(<UtilizationMetricsPanel projects={mockProjects} />);
    await screen.findByText("Total Agents");
    expect(screen.getByText("Overutilized")).toBeDefined();
    expect(screen.getByText("Underutilized")).toBeDefined();
  });

  it("displays project cards", async () => {
    render(<UtilizationMetricsPanel projects={mockProjects} />);
    await screen.findByText("Total Agents");
    expect(screen.getByText("p1")).toBeDefined();
    expect(screen.getByText("p2")).toBeDefined();
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    render(<UtilizationMetricsPanel projects={mockProjects} />);
    await screen.findByText(/Error loading utilization data/);
  });
});
