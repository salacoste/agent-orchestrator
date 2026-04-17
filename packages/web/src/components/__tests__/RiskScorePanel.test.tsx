import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useRiskAlertSSE hook (Story 56.5)
vi.mock("@/hooks/useRiskAlertSSE", () => ({
  useRiskAlertSSE: () => ({
    activeAlerts: [],
    acknowledge: vi.fn(),
  }),
}));

// Mock project data — matches the page.tsx shape
const mockProjects = [
  { id: "project-a", name: "Project A" },
  { id: "project-b", name: "Project B" },
];

// Must import after mocks
import { RiskScorePanel, RiskScoreCard } from "../RiskScorePanel.js";

const singleScoreResponse = {
  projectId: "project-a",
  projectName: "Project A",
  score: 72,
  severityLabel: "high",
  factorCount: 3,
  bottleneckCount: 2,
  contributors: [
    {
      id: "c1",
      title: "Review bottleneck",
      type: "bottleneck",
      score: 87,
      weight: 1.5,
      contributionPercent: 40,
    },
    {
      id: "c2",
      title: "3 stuck stories",
      type: "risk-factor",
      score: 80,
      weight: 1.5,
      contributionPercent: 35,
    },
    {
      id: "c3",
      title: "Sprint health low",
      type: "sprint-health",
      score: 55,
      weight: 1.0,
      contributionPercent: 25,
    },
  ],
  lastUpdated: "2026-04-07T12:00:00Z",
};

const portfolioResponse = {
  scores: [
    {
      projectId: "project-a",
      score: 72,
      severityLabel: "high",
      factorCount: 3,
      bottleneckCount: 2,
      emergingRisks: [],
    },
    {
      projectId: "project-b",
      score: 15,
      severityLabel: "low",
      factorCount: 0,
      bottleneckCount: 0,
      emergingRisks: [],
    },
  ],
  portfolioScore: 43,
  portfolioSeverityLabel: "medium",
  lastUpdated: "2026-04-07T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RiskScorePanel", () => {
  it("renders loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<RiskScorePanel projects={mockProjects} />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("renders portfolio scores after loading", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(portfolioResponse),
    });

    await act(async () => {
      render(<RiskScorePanel projects={mockProjects} />);
    });

    // Wait for data
    await screen.findByText("43");
    expect(screen.getByText(/medium/i)).toBeTruthy();
  });

  it("renders empty state when no scores", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          scores: [],
          portfolioScore: 0,
          portfolioSeverityLabel: "low",
          lastUpdated: "2026-04-07T12:00:00Z",
        }),
    });

    await act(async () => {
      render(<RiskScorePanel projects={[]} />);
    });

    await screen.findByText(/no projects/i);
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Failed" }),
    });

    await act(async () => {
      render(<RiskScorePanel projects={mockProjects} />);
    });

    await screen.findByText(/error/i);
  });
});

describe("RiskScoreCard", () => {
  it("renders score badge with severity styling", () => {
    render(
      <RiskScoreCard
        projectId="project-a"
        projectName="Project A"
        score={72}
        severityLabel="high"
        factorCount={3}
        bottleneckCount={2}
      />,
    );

    expect(screen.getByText("72")).toBeTruthy();
    expect(screen.getByText(/high/i)).toBeTruthy();
    expect(screen.getByText(/Project A/)).toBeTruthy();
  });

  it("shows factor and bottleneck counts", () => {
    render(
      <RiskScoreCard
        projectId="project-a"
        projectName="Project A"
        score={50}
        severityLabel="high"
        factorCount={3}
        bottleneckCount={2}
      />,
    );

    expect(screen.getByText(/3.*factors/)).toBeTruthy();
    expect(screen.getByText(/2.*bottlenecks/)).toBeTruthy();
  });

  it("expands to show contributors on click", async () => {
    render(
      <RiskScoreCard
        projectId="project-a"
        projectName="Project A"
        score={72}
        severityLabel="high"
        factorCount={1}
        bottleneckCount={1}
        contributors={singleScoreResponse.contributors}
      />,
    );

    // Click to expand
    const card = screen.getByText("72").closest("[role=button]") || screen.getByText("72");
    await act(async () => {
      fireEvent.click(card);
    });

    // Should show contributors
    expect(screen.getByText(/Review bottleneck/)).toBeTruthy();
    expect(screen.getByText(/3 stuck stories/)).toBeTruthy();
  });

  it("renders zero score correctly", () => {
    render(
      <RiskScoreCard
        projectId="project-b"
        projectName="Project B"
        score={0}
        severityLabel="low"
        factorCount={0}
        bottleneckCount={0}
      />,
    );

    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText(/low/i)).toBeTruthy();
  });

  it("shows emerging badge when emergingRisks present", () => {
    render(
      <RiskScoreCard
        projectId="project-a"
        projectName="Project A"
        score={72}
        severityLabel="high"
        factorCount={3}
        bottleneckCount={2}
        emergingRisks={[
          {
            id: "project-a-emerging-velocity-drop",
            type: "velocity-drop",
            title: "Velocity dropping",
            status: "emerging" as const,
            severity: 70,
            trajectory: "worsening" as const,
            pattern: "2-week avg 40% of baseline",
            detectedAt: "2026-04-07T12:00:00Z",
            cause: "Throughput decline",
            suggestedAction: "Investigate review bottleneck",
            projectId: "project-a",
            contributingFactors: [],
          },
        ]}
      />,
    );

    expect(screen.getByText(/1 emerging/)).toBeTruthy();
  });

  it("expands to show emerging risk details", async () => {
    render(
      <RiskScoreCard
        projectId="project-a"
        projectName="Project A"
        score={72}
        severityLabel="high"
        factorCount={1}
        bottleneckCount={1}
        emergingRisks={[
          {
            id: "project-a-emerging-velocity-drop",
            type: "velocity-drop",
            title: "Velocity dropping",
            status: "emerging" as const,
            severity: 70,
            trajectory: "worsening" as const,
            pattern: "2-week avg 40% of baseline",
            detectedAt: "2026-04-07T12:00:00Z",
            cause: "Throughput decline in review column",
            suggestedAction: "Add review capacity",
            projectId: "project-a",
            contributingFactors: [],
          },
        ]}
      />,
    );

    const card = screen.getByText("72").closest("[role=button]") || screen.getByText("72");
    await act(async () => {
      fireEvent.click(card);
    });

    expect(screen.getByText("Emerging Risks")).toBeTruthy();
    expect(screen.getByText(/Throughput decline in review column/)).toBeTruthy();
    expect(screen.getByText(/Add review capacity/)).toBeTruthy();
    // Trajectory icon for worsening
    expect(screen.getByText("\u25BC")).toBeTruthy();
  });

  it("renders no emerging message when no risks", () => {
    render(
      <RiskScoreCard
        projectId="project-a"
        projectName="Project A"
        score={72}
        severityLabel="high"
        factorCount={1}
        bottleneckCount={1}
      />,
    );

    expect(screen.queryByText(/emerging/i)).toBeNull();
  });
});
