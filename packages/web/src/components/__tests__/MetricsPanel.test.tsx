import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MetricsPanel from "@/components/MetricsPanel";

describe("MetricsPanel", () => {
  const projectId = "test-project";

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  it("renders metrics panel with grid layout", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          stories: { total: 40, completed: 24, inProgress: 8, blocked: 3 },
          agents: { total: 10, active: 7, utilizationRate: 0.7 },
          cycleTime: { average: 4.5, target: 5, trend: "down" },
          burndown: { remaining: 16, total: 40, progress: 60 },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MetricsPanel projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText("Workflow Health Metrics")).toBeInTheDocument();
    });
  });

  it("displays story count metrics", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          stories: { total: 40, completed: 24, inProgress: 8, blocked: 3 },
          agents: { total: 10, active: 7, utilizationRate: 0.7 },
          cycleTime: { average: 4.5, target: 5, trend: "down" },
          burndown: { remaining: 16, total: 40, progress: 60 },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MetricsPanel projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText(/40 total/i)).toBeInTheDocument();
      expect(screen.getByText(/24 completed, 8 in progress/i)).toBeInTheDocument();
      expect(screen.getByText(/3 stories/i)).toBeInTheDocument();
    });
  });

  it("displays agent utilization metric", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          stories: { total: 40, completed: 24, inProgress: 8, blocked: 3 },
          agents: { total: 10, active: 7, utilizationRate: 0.7 },
          cycleTime: { average: 4.5, target: 5, trend: "down" },
          burndown: { remaining: 16, total: 40, progress: 60 },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MetricsPanel projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText(/70%/i)).toBeInTheDocument();
      expect(screen.getByText(/7 of 10 agents/i)).toBeInTheDocument();
    });
  });

  it("displays sprint progress metric", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          stories: { total: 40, completed: 24, inProgress: 8, blocked: 3 },
          agents: { total: 10, active: 7, utilizationRate: 0.7 },
          cycleTime: { average: 4.5, target: 5, trend: "down" },
          burndown: { remaining: 16, total: 40, progress: 60 },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MetricsPanel projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText(/60%/i)).toBeInTheDocument();
      expect(screen.getByText(/16 of 40 remaining/i)).toBeInTheDocument();
    });
  });

  it("shows color coding based on thresholds", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          stories: { total: 40, completed: 24, inProgress: 8, blocked: 6 },
          agents: { total: 10, active: 8, utilizationRate: 0.8 },
          cycleTime: { average: 6, target: 5, trend: "up" },
          burndown: { remaining: 16, total: 40, progress: 60 },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MetricsPanel projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText("Workflow Health Metrics")).toBeInTheDocument();
    });

    // Check for blocked stories text
    const blockedMetric = screen.getByText(/6 stories/i);
    expect(blockedMetric).toBeInTheDocument();
    // Check color is on the element itself (blocked > 5 should be red)
    expect(blockedMetric.className).toContain("text-red-600");
  });

  it("displays loading state while fetching", () => {
    global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves

    render(<MetricsPanel projectId={projectId} />);

    expect(screen.getByText("Loading metrics...")).toBeInTheDocument();
  });

  it("displays error state on fetch failure", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("API error")));

    render(<MetricsPanel projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
    });
  });

  it("opens and closes blocked stories modal", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          stories: {
            total: 40,
            completed: 24,
            inProgress: 8,
            blocked: 2,
            blockedStories: [
              { id: "1-2-test-story", status: "blocked" },
              { id: "2-1-another-story", status: "review" },
            ],
          },
          agents: { total: 10, active: 7, utilizationRate: 0.7 },
          cycleTime: { average: 4.5, target: 5, trend: "down" },
          burndown: { remaining: 16, total: 40, progress: 60 },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MetricsPanel projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText("Workflow Health Metrics")).toBeInTheDocument();
    });

    // Click on blocked metric to open modal
    const blockedMetric = screen.getByText(/2 stories/i);
    blockedMetric.click();

    // Check modal opens
    await waitFor(() => {
      expect(screen.getByText(/Blocked Stories \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText("1-2-test-story")).toBeInTheDocument();
      expect(screen.getByText("2-1-another-story")).toBeInTheDocument();
    });

    // Click close button
    const closeButton = screen.getByText("Close");
    closeButton.click();

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Blocked Stories/i)).not.toBeInTheDocument();
    });
  });
});
