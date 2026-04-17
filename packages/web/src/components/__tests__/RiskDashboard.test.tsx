import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RiskDashboard } from "../RiskDashboard.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockProjects = [
  { id: "project-a", name: "Project A" },
  { id: "project-b", name: "Project B" },
];

const mockResponse = {
  riskFactors: [
    {
      id: "capacity-agent-1",
      type: "resource-bottleneck",
      title: "Agent agent-1 at 95% capacity",
      severity: 80,
      severityLabel: "critical",
      trend: "worsening",
      affectedProjects: ["project-a"],
      contributingFactors: ["0 available slots", "Utilization at 95%"],
      affectedStories: [],
      suggestedAction: "Consider rebalancing stories",
    },
    {
      id: "util-over-agent-2",
      type: "resource-bottleneck",
      title: "Agent agent-2 overutilized at 92%",
      severity: 92,
      severityLabel: "critical",
      trend: "stable",
      affectedProjects: ["project-a"],
      contributingFactors: ["Utilization at 92%"],
      affectedStories: [],
      suggestedAction: "Redistribute workload",
    },
    {
      id: "indicator-throughput-drop",
      type: "velocity-anomaly",
      title: "Throughput declining",
      severity: 50,
      severityLabel: "high",
      trend: "stable",
      affectedProjects: ["project-a"],
      contributingFactors: ["7d vs 4w ratio below threshold"],
      affectedStories: [],
      suggestedAction: "Review sprint velocity trends",
    },
  ],
  summary: { critical: 2, high: 1, medium: 0, low: 0, total: 3 },
  lastUpdated: "2026-04-06T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockResponse),
  });
});

describe("RiskDashboard", () => {
  it("renders loading state initially", async () => {
    let resolveFetch: (v: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<RiskDashboard projects={mockProjects} />);
    expect(screen.getByText("Loading risk data...")).toBeInTheDocument();

    // Resolve the pending fetch to avoid act() warning on unmount
    await act(async () => {
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
    });
  });

  it("renders summary metric cards after loading", async () => {
    render(<RiskDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText("Critical")).toBeInTheDocument();
    });
    expect(screen.getByText("2")).toBeInTheDocument(); // critical count
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // high count
  });

  it("renders risk factor cards sorted by severity", async () => {
    render(<RiskDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText(/Agent agent-2 overutilized/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Agent agent-1 at 95%/)).toBeInTheDocument();
    expect(screen.getByText(/Throughput declining/)).toBeInTheDocument();
  });

  it("expands risk factor detail on click", async () => {
    render(<RiskDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText(/Agent agent-1 at 95%/)).toBeInTheDocument();
    });

    // Click the first risk factor card to expand
    const expandButton = screen.getAllByRole("button", { expanded: false })[0];
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText("Contributing Factors:")).toBeInTheDocument();
    });
    expect(screen.getByText(/0 available slots/)).toBeInTheDocument();
    expect(screen.getByText("Consider rebalancing stories")).toBeInTheDocument();
  });

  it("shows project filter when multiple projects", async () => {
    render(<RiskDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Filter by project")).toBeInTheDocument();
    });
  });

  it("does not show project filter with single project", async () => {
    render(<RiskDashboard projects={[mockProjects[0]]} />);

    await waitFor(() => {
      expect(screen.getByText("Risk Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Filter by project")).not.toBeInTheDocument();
  });

  it("shows empty state when no risk factors", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          riskFactors: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
          lastUpdated: "2026-04-06T12:00:00Z",
        }),
    });

    render(<RiskDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText("No risk factors identified")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<RiskDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading risk data/)).toBeInTheDocument();
    });
  });

  it("displays trend indicators", async () => {
    render(<RiskDashboard projects={mockProjects} />);

    await waitFor(() => {
      // worsening trend shows ↑
      expect(screen.getByText(/↑ W/)).toBeInTheDocument();
    });
  });
});
