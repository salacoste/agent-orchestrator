import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BottleneckDashboard, BottleneckCard } from "../BottleneckDashboard.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockProjects = [
  { id: "project-a", name: "Project A" },
  { id: "project-b", name: "Project B" },
];

const mockBottleneckItem = {
  id: "bn-column-review",
  type: "column-bottleneck" as const,
  title: '"review" is a flow bottleneck (3.2x next column)',
  severity: 75,
  severityLabel: "high" as const,
  impact: {
    storiesAffected: 12,
    estimatedDelayDays: 3.5,
    impactScore: 87,
  },
  trend: "worsening" as const,
  affectedProjects: ["project-a"],
  affectedStories: ["S-12", "S-34", "S-56"],
  contributingFactors: [
    "Column dwell time is 3.2x the next slowest column",
    "Average dwell: 5.0 days",
  ],
  suggestedAction:
    "Consider adding capacity to the bottleneck column or splitting the workflow step",
};

const mockResponse = {
  bottlenecks: [mockBottleneckItem],
  summary: {
    stuckStories: 0,
    wipViolations: 1,
    agingStories: 0,
    overloadedAgents: 2,
    resourceConflicts: 0,
    totalBottlenecks: 3,
  },
  lastUpdated: "2026-04-06T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockResponse),
  });
});

describe("BottleneckDashboard", () => {
  it("renders loading state initially", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<BottleneckDashboard projects={mockProjects} />);
    expect(screen.getByText("Loading bottleneck data...")).toBeInTheDocument();
  });

  it("renders summary cards after data loads", async () => {
    render(<BottleneckDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText("Bottleneck Analysis")).toBeInTheDocument();
    });

    expect(screen.getByText("Stuck Stories")).toBeInTheDocument();
    expect(screen.getByText("WIP Violations")).toBeInTheDocument();
    expect(screen.getByText("Aging Stories")).toBeInTheDocument();
    expect(screen.getByText("Overloaded")).toBeInTheDocument();
    expect(screen.getByText("Conflicts")).toBeInTheDocument();
  });

  it("renders bottleneck items sorted by impact score", async () => {
    render(<BottleneckDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText(/review.*flow bottleneck/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no bottlenecks", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          bottlenecks: [],
          summary: {
            stuckStories: 0,
            wipViolations: 0,
            agingStories: 0,
            overloadedAgents: 0,
            resourceConflicts: 0,
            totalBottlenecks: 0,
          },
          lastUpdated: "2026-04-06T12:00:00Z",
        }),
    });

    render(<BottleneckDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText("No bottlenecks identified")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<BottleneckDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading bottleneck data/)).toBeInTheDocument();
    });
  });

  it("displays project filter when multiple projects", async () => {
    render(<BottleneckDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Filter by project")).toBeInTheDocument();
    });
  });

  it("does not show project filter for single project", async () => {
    render(<BottleneckDashboard projects={[mockProjects[0]!]} />);

    await waitFor(() => {
      expect(screen.queryByLabelText("Filter by project")).toBeNull();
    });
  });

  it("displays last updated timestamp", async () => {
    render(<BottleneckDashboard projects={mockProjects} />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    });
  });
});

describe("BottleneckCard", () => {
  it("renders bottleneck title and type", () => {
    render(<BottleneckCard item={mockBottleneckItem} isExpanded={false} onToggle={() => {}} />);

    expect(screen.getByText(/review.*flow bottleneck/)).toBeInTheDocument();
  });

  it("shows expanded details on toggle", async () => {
    render(<BottleneckCard item={mockBottleneckItem} isExpanded={true} onToggle={() => {}} />);

    // Contributing factors visible
    expect(screen.getByText("Contributing Factors:")).toBeInTheDocument();
    expect(screen.getByText(/Column dwell time/)).toBeInTheDocument();

    // Affected stories visible
    expect(screen.getByText("Affected Stories:")).toBeInTheDocument();
    expect(screen.getByText("S-12, S-34, S-56")).toBeInTheDocument();

    // Suggested action visible
    expect(screen.getByText(/Consider adding capacity/)).toBeInTheDocument();
  });

  it("hides details when not expanded", () => {
    render(<BottleneckCard item={mockBottleneckItem} isExpanded={false} onToggle={() => {}} />);

    expect(screen.queryByText("Contributing Factors:")).toBeNull();
    expect(screen.queryByText("Affected Stories:")).toBeNull();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<BottleneckCard item={mockBottleneckItem} isExpanded={false} onToggle={onToggle} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows trend indicator", () => {
    render(<BottleneckCard item={mockBottleneckItem} isExpanded={false} onToggle={() => {}} />);

    expect(screen.getByText(/↑ W/)).toBeInTheDocument();
  });

  it("shows impact score", () => {
    render(<BottleneckCard item={mockBottleneckItem} isExpanded={false} onToggle={() => {}} />);

    expect(screen.getByText(/Impact: 87/)).toBeInTheDocument();
  });

  it("shows project count", () => {
    render(<BottleneckCard item={mockBottleneckItem} isExpanded={false} onToggle={() => {}} />);

    expect(screen.getByText("1 project")).toBeInTheDocument();
  });
});
