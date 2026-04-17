import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ForecastAccuracyChart } from "../ForecastAccuracyChart";

const mockAccuracyData = {
  calibration: {
    totalForecasts: 5,
    withinP50: 3,
    withinP80: 4,
    withinP95: 5,
    p50Accuracy: 60,
    p80Accuracy: 80,
    p95Accuracy: 100,
    bias: 0.4,
    insufficientData: false,
  },
  forecastComparisons: [
    {
      timestamp: "2026-03-01T10:00:00Z",
      predictedP50: "2026-03-10",
      predictedP80: "2026-03-13",
      predictedP95: "2026-03-17",
      actualDate: "2026-03-11",
      biasDays: 1,
    },
    {
      timestamp: "2026-03-15T10:00:00Z",
      predictedP50: "2026-03-25",
      predictedP80: "2026-03-28",
      predictedP95: "2026-04-02",
      actualDate: "2026-03-24",
      biasDays: -1,
    },
  ],
  accuracyTrend: "stable" as const,
};

describe("ForecastAccuracyChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockAccuracyData,
      }),
    ) as unknown as typeof fetch;
  });

  it("renders 'insufficient data' message when fewer than 2 completed forecasts", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockAccuracyData,
          calibration: {
            ...mockAccuracyData.calibration,
            insufficientData: true,
          },
          forecastComparisons: [],
        }),
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Forecast accuracy requires at least 2 completed sprint forecasts/),
      ).toBeInTheDocument();
    });
  });

  it("renders scatter plot with data points when completed forecasts exist", async () => {
    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Calibration Scatter Plot")).toBeInTheDocument();
    });

    // Should render the SVG chart
    const svg = screen.getByRole("img", {
      name: /Forecast accuracy calibration scatter plot/i,
    });
    expect(svg).toBeInTheDocument();
  });

  it("renders calibration stat cards with correct accuracy percentages", async () => {
    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("60%")).toBeInTheDocument();
    });

    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders bias indicator with optimistic label", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockAccuracyData,
          calibration: {
            ...mockAccuracyData.calibration,
            bias: 0.7,
          },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Optimistic (70%)")).toBeInTheDocument();
    });
  });

  it("renders bias indicator with pessimistic label", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockAccuracyData,
          calibration: {
            ...mockAccuracyData.calibration,
            bias: 0.3,
          },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Pessimistic (70%)")).toBeInTheDocument();
    });
  });

  it("renders bias indicator with neutral label", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockAccuracyData,
          calibration: {
            ...mockAccuracyData.calibration,
            bias: 0.5,
          },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Neutral")).toBeInTheDocument();
    });
  });

  it("renders accuracy trend 'improving' label", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockAccuracyData,
          accuracyTrend: "improving",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText(/Improving/)).toBeInTheDocument();
    });
  });

  it("renders accuracy trend 'degrading' label", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockAccuracyData,
          accuracyTrend: "degrading",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText(/Degrading/)).toBeInTheDocument();
    });
  });

  it("renders accuracy trend 'stable' label", async () => {
    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText(/Stable/)).toBeInTheDocument();
    });
  });

  it("fetches data with correct project ID", async () => {
    render(<ForecastAccuracyChart projectId="my-project" />);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sprint/my-project/forecast-accuracy",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("handles fetch error gracefully", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load forecast accuracy data")).toBeInTheDocument();
    });
  });

  it("shows insufficient data when 1 comparison exists (insufficientData=false)", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          ...mockAccuracyData,
          calibration: {
            ...mockAccuracyData.calibration,
            insufficientData: false,
          },
          forecastComparisons: [mockAccuracyData.forecastComparisons[0]],
        }),
      }),
    ) as unknown as typeof fetch;

    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Forecast accuracy requires at least 2 completed sprint forecasts/),
      ).toBeInTheDocument();
    });
  });

  it("renders 'Based on N completed forecasts' footer", async () => {
    render(<ForecastAccuracyChart projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText(/Based on 5 completed forecasts/)).toBeInTheDocument();
    });
  });
});
