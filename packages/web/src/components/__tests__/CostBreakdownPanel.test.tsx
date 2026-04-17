/**
 * CostBreakdownPanel component tests (Story 60.6).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseCostData = vi.fn();

vi.mock("@/hooks/useCostData", () => ({
  useCostData: (...args: unknown[]) => mockUseCostData(...args),
}));

import { CostBreakdownPanel } from "../CostBreakdownPanel";

const MOCK_SUMMARY = {
  dimension: "summary" as const,
  totalTokens: 150000,
  totalCost: 0.45,
  byTier: {
    low: { tokens: 10000, cost: 0.01, sessions: 2 },
    medium: { tokens: 100000, cost: 0.3, sessions: 5 },
    high: { tokens: 40000, cost: 0.14, sessions: 1 },
  },
};

describe("CostBreakdownPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state", () => {
    mockUseCostData.mockReturnValue({ summary: null, loading: true, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("Loading cost data...")).toBeInTheDocument();
  });

  it("renders empty state when not loading and no data", () => {
    mockUseCostData.mockReturnValue({ summary: null, loading: false, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("No cost data available.")).toBeInTheDocument();
  });

  it("renders error state when no summary and error exists", () => {
    mockUseCostData.mockReturnValue({
      summary: null,
      loading: false,
      error: "Failed to fetch cost data",
    });
    render(<CostBreakdownPanel />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to fetch cost data");
  });

  it("renders stale data warning when summary exists but error is set", () => {
    mockUseCostData.mockReturnValue({
      summary: MOCK_SUMMARY,
      loading: false,
      error: "Failed to fetch cost data",
    });
    render(<CostBreakdownPanel />);
    expect(screen.getByText(/data may be stale/)).toBeInTheDocument();
    expect(screen.getByText("150,000")).toBeInTheDocument();
  });

  it("renders summary with total tokens and cost", () => {
    mockUseCostData.mockReturnValue({ summary: MOCK_SUMMARY, loading: false, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("150,000")).toBeInTheDocument();
    expect(screen.getByText("$0.45")).toBeInTheDocument();
  });

  it("renders all three tier rows", () => {
    mockUseCostData.mockReturnValue({ summary: MOCK_SUMMARY, loading: false, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("Haiku")).toBeInTheDocument();
    expect(screen.getByText("Sonnet")).toBeInTheDocument();
    expect(screen.getByText("Opus")).toBeInTheDocument();
  });

  it("renders tier token counts and costs", () => {
    mockUseCostData.mockReturnValue({ summary: MOCK_SUMMARY, loading: false, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("10,000")).toBeInTheDocument();
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.getByText("40,000")).toBeInTheDocument();
    expect(screen.getByText("$0.01")).toBeInTheDocument();
    expect(screen.getByText("$0.30")).toBeInTheDocument();
    expect(screen.getByText("$0.14")).toBeInTheDocument();
  });

  it("renders session counts per tier with accessible labels", () => {
    mockUseCostData.mockReturnValue({ summary: MOCK_SUMMARY, loading: false, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("2s")).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();
    expect(screen.getByText("1s")).toBeInTheDocument();
    expect(screen.getByLabelText("2 sessions")).toBeInTheDocument();
  });

  it("renders panel with data-testid and region role", () => {
    mockUseCostData.mockReturnValue({ summary: null, loading: true, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByTestId("cost-breakdown-panel")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Model Cost" })).toBeInTheDocument();
  });

  it("renders progress bars with aria attributes", () => {
    mockUseCostData.mockReturnValue({ summary: MOCK_SUMMARY, loading: false, error: null });
    render(<CostBreakdownPanel />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAttribute("aria-label", "Haiku token usage");
    expect(bars[1]).toHaveAttribute("aria-label", "Sonnet token usage");
    expect(bars[2]).toHaveAttribute("aria-label", "Opus token usage");
  });

  it("renders tier data-testid attributes", () => {
    mockUseCostData.mockReturnValue({ summary: MOCK_SUMMARY, loading: false, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByTestId("tier-low")).toBeInTheDocument();
    expect(screen.getByTestId("tier-medium")).toBeInTheDocument();
    expect(screen.getByTestId("tier-high")).toBeInTheDocument();
  });

  it("handles zero total tokens without crash", () => {
    const zeroSummary = {
      dimension: "summary" as const,
      totalTokens: 0,
      totalCost: 0,
      byTier: {
        low: { tokens: 0, cost: 0, sessions: 0 },
        medium: { tokens: 0, cost: 0, sessions: 0 },
        high: { tokens: 0, cost: 0, sessions: 0 },
      },
    };
    mockUseCostData.mockReturnValue({ summary: zeroSummary, loading: false, error: null });
    render(<CostBreakdownPanel />);
    // Total cost shown (appears for total + each tier, so use getAllByText)
    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(1);
    // All three tier rows render with their tier names
    expect(screen.getByText("Haiku")).toBeInTheDocument();
    expect(screen.getByText("Sonnet")).toBeInTheDocument();
    expect(screen.getByText("Opus")).toBeInTheDocument();
  });

  it("formats large costs with locale formatting", () => {
    const largeSummary = {
      dimension: "summary" as const,
      totalTokens: 5000000,
      totalCost: 1234.56,
      byTier: {
        low: { tokens: 100000, cost: 12.34, sessions: 5 },
        medium: { tokens: 4000000, cost: 1000, sessions: 20 },
        high: { tokens: 900000, cost: 222.22, sessions: 3 },
      },
    };
    mockUseCostData.mockReturnValue({ summary: largeSummary, loading: false, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  });

  it("renders header with Model Cost label", () => {
    mockUseCostData.mockReturnValue({ summary: null, loading: true, error: null });
    render(<CostBreakdownPanel />);
    expect(screen.getByText("Model Cost")).toBeInTheDocument();
  });
});
