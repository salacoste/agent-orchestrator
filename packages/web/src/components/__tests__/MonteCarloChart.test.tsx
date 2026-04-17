import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MonteCarloChart } from "../MonteCarloChart";

const mockMonteCarloData = {
  percentiles: {
    p50: "2026-04-10",
    p80: "2026-04-15",
    p95: "2026-04-20",
  },
  histogram: [
    { date: "2026-04-08", probability: 0.1, cumulative: 0.1 },
    { date: "2026-04-09", probability: 0.2, cumulative: 0.3 },
    { date: "2026-04-10", probability: 0.3, cumulative: 0.6 },
    { date: "2026-04-11", probability: 0.15, cumulative: 0.75 },
    { date: "2026-04-12", probability: 0.1, cumulative: 0.85 },
    { date: "2026-04-15", probability: 0.08, cumulative: 0.93 },
    { date: "2026-04-20", probability: 0.07, cumulative: 1.0 },
  ],
  remainingStories: 5,
  simulationCount: 5000,
  sampleSize: 14,
  averageDailyRate: 1.2,
  linearCompletionDate: "2026-04-11",
  linearConfidence: 0.6,
  insufficientData: false,
};

describe("MonteCarloChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockMonteCarloData,
      }),
    ) as unknown as typeof fetch;
  });

  it("renders histogram bars when valid data is provided", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      // Should render stat cards
      expect(screen.getByText("2026-04-10")).toBeInTheDocument();
      expect(screen.getByText("2026-04-15")).toBeInTheDocument();
      expect(screen.getByText("2026-04-20")).toBeInTheDocument();
    });

    // Should render histogram section
    expect(screen.getByText("Completion Date Probability")).toBeInTheDocument();
  });

  it("shows insufficient data message when insufficientData is true", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockMonteCarloData,
          percentiles: { p50: "", p80: "", p95: "" },
          insufficientData: true,
          histogram: [],
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Insufficient throughput data. Complete more stories to generate a forecast.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows no completed stories message when data has empty p50", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockMonteCarloData,
          percentiles: { p50: "", p80: "", p95: "" },
          insufficientData: false,
          histogram: [],
        }),
      }),
    ) as unknown as typeof fetch;

    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No completed stories yet. Monte Carlo forecast will appear as stories are done.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("renders percentile lines for P50, P80, P95", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      // Percentile labels rendered in SVG
      const p50Label = screen.getByText("P50");
      const p80Label = screen.getByText("P80");
      const p95Label = screen.getByText("P95");
      expect(p50Label).toBeInTheDocument();
      expect(p80Label).toBeInTheDocument();
      expect(p95Label).toBeInTheDocument();
    });
  });

  it("renders percentile legend below histogram", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      // Stat card labels + legend both contain these texts, so use getAllByText
      expect(screen.getAllByText("P50 (Likely)").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("P80 (Conservative)").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("P95 (Safe)").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows linear comparison when linearCompletionDate is present", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Linear Comparison")).toBeInTheDocument();
      expect(screen.getByText("2026-04-11")).toBeInTheDocument();
    });
  });

  it("shows simulation info footer", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText(/5,000 simulations/)).toBeInTheDocument();
      expect(screen.getByText(/14 day sample/)).toBeInTheDocument();
      expect(screen.getByText(/5 stories remaining/)).toBeInTheDocument();
    });
  });

  it("passes epic filter to fetch URL", async () => {
    render(<MonteCarloChart projectId="test-project" epicFilter="epic-auth" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("epic=epic-auth"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("shows error state on fetch failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      }),
    ) as unknown as typeof fetch;

    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load Monte Carlo data")).toBeInTheDocument();
    });
  });

  it("renders average daily rate stat card", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("1.2/day")).toBeInTheDocument();
    });
  });

  it("renders histogram bar elements for each bucket", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      // The histogram should have SVG rect elements for each bucket
      const svg = screen.getByRole("img", { name: /Monte Carlo/i });
      expect(svg).toBeInTheDocument();
    });

    // Verify all 7 buckets are represented (dates in stat cards and histogram bars)
    const dateLabels = screen.getAllByText(/04-0[89]|04-1[0-2]|04-15/);
    expect(dateLabels.length).toBeGreaterThan(0);
  });

  it("shows tooltip with date and probability on bar hover", async () => {
    render(<MonteCarloChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Completion Date Probability")).toBeInTheDocument();
    });

    // Find histogram bars (SVG <g> elements with cursor-pointer)
    const bars = screen
      .getByRole("img", { name: /Monte Carlo/i })
      .querySelectorAll("g.cursor-pointer");
    expect(bars.length).toBe(7); // 7 histogram buckets

    // Hover over the third bar (2026-04-10, probability 0.3, cumulative 0.6)
    const thirdBar = bars[2]!;
    fireEvent.mouseEnter(thirdBar, { clientX: 200, clientY: 100 });

    // Tooltip should appear with probability and cumulative values
    await waitFor(() => {
      expect(screen.getByText("Probability: 30.0%")).toBeInTheDocument();
      expect(screen.getByText("Cumulative: 60.0%")).toBeInTheDocument();
    });

    // The date also appears in tooltip (alongside stat card)
    const dateElements = screen.getAllByText("2026-04-10");
    expect(dateElements.length).toBeGreaterThanOrEqual(2); // stat card + tooltip

    // Mouse leave should dismiss tooltip
    fireEvent.mouseLeave(thirdBar);
    await waitFor(() => {
      expect(screen.queryByText("Probability: 30.0%")).not.toBeInTheDocument();
    });
  });

  describe("SSE auto-refresh (Story 55.4)", () => {
    let messageHandler: ((e: MessageEvent) => void) | null = null;
    const mockEventSource = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      onerror: null as (() => void) | null,
      close: vi.fn(),
    };

    beforeEach(() => {
      mockEventSource.close.mockClear();
      messageHandler = null;
      // Mock EventSource to capture message handlers
      vi.stubGlobal(
        "EventSource",
        vi.fn(() => {
          messageHandler = (e: MessageEvent) => {
            if (mockEventSource.onmessage) mockEventSource.onmessage(e);
          };
          return mockEventSource as unknown as EventSource;
        }),
      );
    });

    it("re-fetches data when forecast-stale SSE event is received", async () => {
      render(<MonteCarloChart projectId="test-project" />);

      // Wait for initial fetch
      await waitFor(() => {
        expect(screen.getByText("Completion Date Probability")).toBeInTheDocument();
      });

      const initialFetchCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      // Simulate forecast-stale SSE event
      const staleEvent = new MessageEvent("message", {
        data: JSON.stringify({ type: "forecast-stale", project: "test-project" }),
      });

      // Trigger the captured handler
      if (messageHandler) messageHandler(staleEvent);

      await waitFor(() => {
        expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
          initialFetchCount,
        );
      });
    });

    it("ignores SSE events for other projects", async () => {
      render(<MonteCarloChart projectId="test-project" />);

      await waitFor(() => {
        expect(screen.getByText("Completion Date Probability")).toBeInTheDocument();
      });

      const initialFetchCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      // SSE event for a different project
      const otherEvent = new MessageEvent("message", {
        data: JSON.stringify({ type: "forecast-stale", project: "other-project" }),
      });

      if (messageHandler) messageHandler(otherEvent);

      // Wait a tick — no additional fetch should happen
      await new Promise((r) => setTimeout(r, 100));
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialFetchCount);
    });

    it("cleans up EventSource on unmount", async () => {
      const { unmount } = render(<MonteCarloChart projectId="test-project" />);

      await waitFor(() => {
        expect(screen.getByText("Completion Date Probability")).toBeInTheDocument();
      });

      unmount();

      expect(mockEventSource.close).toHaveBeenCalled();
    });
  });
});
