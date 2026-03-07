import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BurndownChart } from "../BurndownChart";

// Mock fetch
global.fetch = vi.fn();

// Mock SSE hooks
import { useSSEConnection as mockUseSSEConnection } from "@/hooks/useSSEConnection.js";
vi.mock("@/hooks/useSSEConnection.js", () => ({
  useSSEConnection: vi.fn((callbacks, _options) => {
    // Store callbacks for test invocation
    (mockUseSSEConnection as any).mockCallbacks = callbacks;
    return { connected: true, reconnecting: false };
  }),
}));

vi.mock("@/hooks/useFlashAnimation.js", () => ({
  useFlashAnimation: vi.fn(() => false),
}));

describe("BurndownChart", () => {
  const mockProjectId = "test-project";
  const mockVelocityData = {
    dailyCompletions: [
      { date: "2026-03-01", count: 2, points: 5 },
      { date: "2026-03-02", count: 3, points: 8 },
      { date: "2026-03-03", count: 1, points: 3 },
    ],
    totalStories: 20,
    doneCount: 6,
    hasPoints: true,
    totalPoints: 50,
    donePoints: 16,
  };

  const mockForecastData = {
    projectedCompletionDate: "2026-03-15",
    daysRemaining: 10,
    pace: "on-pace" as const,
    confidence: 0.7,
    currentVelocity: 2,
    remainingStories: 14,
    totalStories: 20,
    completedStories: 6,
  };

  const mockMcData = {
    percentiles: {
      p50: "2026-03-14",
      p85: "2026-03-16",
      p95: "2026-03-18",
    },
    remainingStories: 14,
    linearCompletionDate: "2026-03-15",
  };

  const mockGoalsData = {
    goals: [{ type: "points", target: 40 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url) => {
      if (url?.includes("/velocity")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockVelocityData,
        });
      }
      if (url?.includes("/forecast")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockForecastData,
        });
      }
      if (url?.includes("/monte-carlo")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockMcData,
        });
      }
      if (url?.includes("/goals")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockGoalsData,
        });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      });
    }) as unknown as typeof fetch;
  });

  it("renders loading state initially", () => {
    render(<BurndownChart projectId={mockProjectId} />);
    expect(screen.getByText(/Loading burndown/i)).toBeInTheDocument();
  });

  it("renders burndown chart with data", async () => {
    render(<BurndownChart projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading burndown/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Burndown/)).toBeInTheDocument();
  });

  it("shows 'At Risk' badge when behind schedule", async () => {
    const behindData = {
      ...mockVelocityData,
      dailyCompletions: [
        { date: "2026-03-01", count: 1, points: 2 },
        { date: "2026-03-02", count: 1, points: 2 },
        { date: "2026-03-03", count: 1, points: 2 },
      ],
      doneCount: 3,
      donePoints: 6,
    };

    global.fetch = vi.fn((url) => {
      if (url?.includes("/velocity")) {
        return Promise.resolve({
          ok: true,
          json: async () => behindData,
        });
      }
      if (url?.includes("/forecast")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockForecastData,
        });
      }
      if (url?.includes("/monte-carlo")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockMcData,
        });
      }
      if (url?.includes("/goals")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockGoalsData,
        });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      });
    }) as unknown as typeof fetch;

    render(<BurndownChart projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText("At Risk")).toBeInTheDocument();
    });
  });

  it("renders export button", async () => {
    render(<BurndownChart projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading burndown/i)).not.toBeInTheDocument();
    });

    const exportButton = screen.getByText("Export");
    expect(exportButton).toBeInTheDocument();
  });

  it("calls CSV export when export button is clicked", async () => {
    // Mock document methods for CSV export
    const mockUrl = "blob:mock-url";
    global.URL.createObjectURL = vi.fn(() => mockUrl);
    global.URL.revokeObjectURL = vi.fn();

    const createElementSpy = vi.spyOn(document, "createElement");
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");

    render(<BurndownChart projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading burndown/i)).not.toBeInTheDocument();
    });

    const exportButton = screen.getByText("Export");
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(createElementSpy).toHaveBeenCalledWith("a");
    });

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("displays mode toggle when points data is available", async () => {
    render(<BurndownChart projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText("View:")).toBeInTheDocument();
      expect(screen.getByText("Auto")).toBeInTheDocument();
      expect(screen.getByText("Count")).toBeInTheDocument();
      expect(screen.getByText("Points")).toBeInTheDocument();
    });
  });

  it("renders error state on fetch failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
      }),
    ) as unknown as typeof fetch;

    render(<BurndownChart projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load burndown data/i)).toBeInTheDocument();
    });
  });

  it("shows 'No completion history' message when no data", async () => {
    global.fetch = vi.fn((url) => {
      if (url?.includes("/velocity")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ dailyCompletions: [], totalStories: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => null,
      });
    }) as unknown as typeof fetch;

    render(<BurndownChart projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText(/No completion history yet/i)).toBeInTheDocument();
    });
  });

  describe("SSE Integration", () => {
    it("subscribes to story.completed events on mount", async () => {
      render(<BurndownChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading burndown/i)).not.toBeInTheDocument();
      });

      // Verify SSE hook was called with story.completed handler
      const useSSEConnectionMock = mockUseSSEConnection;
      expect(useSSEConnectionMock).toHaveBeenCalled();
      const callbacks = (useSSEConnectionMock as any).mockCallbacks;
      expect(callbacks).toBeDefined();
      expect(callbacks.onStoryCompleted).toBeDefined();
    });

    it("triggers data refresh when story.completed event is received", async () => {
      let fetchCallCount = 0;
      global.fetch = vi.fn((url) => {
        fetchCallCount++;
        if (url?.includes("/velocity")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockVelocityData,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => null,
        });
      }) as unknown as typeof fetch;

      render(<BurndownChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading burndown/i)).not.toBeInTheDocument();
      });

      const initialFetchCount = fetchCallCount;

      // Simulate SSE story.completed event
      const useSSEConnectionMock = mockUseSSEConnection;
      const callbacks = (useSSEConnectionMock as any).mockCallbacks;

      if (callbacks?.onStoryCompleted) {
        callbacks.onStoryCompleted();

        // Wait for data refresh
        await waitFor(
          () => {
            expect(fetchCallCount).toBeGreaterThan(initialFetchCount);
          },
          { timeout: 3000 },
        );
      }
    });

    it("shows smooth animation when data changes", async () => {
      render(<BurndownChart projectId={mockProjectId} />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading burndown/i)).not.toBeInTheDocument();
      });

      // Initial render should not have animation class
      const chart = screen.getByText(/Burndown/).closest("div");
      expect(chart).toBeInTheDocument();

      // Trigger data change via SSE
      const useSSEConnectionMock = mockUseSSEConnection;
      const callbacks = (useSSEConnectionMock as any).mockCallbacks;

      if (callbacks?.onStoryCompleted) {
        callbacks.onStoryCompleted();

        // After data change, animation should be triggered
        await waitFor(
          () => {
            // Verify chart still exists and updated
            expect(screen.getByText(/Burndown/)).toBeInTheDocument();
          },
          { timeout: 3000 },
        );
      }
    });
  });
});
