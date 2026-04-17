/**
 * ScenarioComparisonView component tests (Story 54.4, Task 4).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ScenarioComparisonView } from "../ScenarioComparisonView";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const simResultA = {
  p50Days: 5,
  p80Days: 7,
  p95Days: 10,
  onTimeProbability: 0.92,
  confidence: 0.88,
  iterationsRun: 1000,
};

const simResultB = {
  p50Days: 6,
  p80Days: 8,
  p95Days: 12,
  onTimeProbability: 0.78,
  confidence: 0.65,
  iterationsRun: 1000,
};

const comparisonData = {
  scenarios: [
    {
      name: "High Prob",
      storyCount: 3,
      result: simResultA,
      rank: 1,
      color: "green" as const,
      isRecommended: true,
      id: "scen-1",
      status: "simulated",
    },
    {
      name: "Low Prob",
      storyCount: 3,
      result: simResultB,
      rank: 2,
      color: "amber" as const,
      isRecommended: false,
      id: "scen-2",
      status: "simulated",
    },
  ],
  warnings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ScenarioComparisonView", () => {
  it("renders loading state", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ScenarioComparisonView ids={["scen-1", "scen-2"]} />);
    expect(screen.getByText("Loading comparison...")).toBeInTheDocument();
  });

  it("renders comparison with ranked scenarios", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonData),
    });

    render(<ScenarioComparisonView ids={["scen-1", "scen-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("High Prob")).toBeInTheDocument();
      expect(screen.getByText("Low Prob")).toBeInTheDocument();
    });
  });

  it("highlights best metric per row", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonData),
    });

    render(<ScenarioComparisonView ids={["scen-1", "scen-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("High Prob")).toBeInTheDocument();
    });

    // p50Days: 5.0 is best (lowest), should have checkmark
    expect(screen.getByText("5.0 ✓")).toBeInTheDocument();
    // onTimeProbability: 92% is best (highest)
    expect(screen.getByText("92% ✓")).toBeInTheDocument();
  });

  it("shows Recommended badge for rank 1", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonData),
    });

    render(<ScenarioComparisonView ids={["scen-1", "scen-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("Recommended")).toBeInTheDocument();
    });
  });

  it("shows color indicators per scenario", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonData),
    });

    render(<ScenarioComparisonView ids={["scen-1", "scen-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("High Prob")).toBeInTheDocument();
    });

    // Two color dots (one per scenario)
    const dots = screen.getAllByText("").filter((el) => el.className.includes("rounded-full"));
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });

  it("handles error state", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    render(<ScenarioComparisonView ids={["missing-1", "missing-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });

  it("each scenario name links to detail page", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonData),
    });

    render(<ScenarioComparisonView ids={["scen-1", "scen-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("High Prob")).toBeInTheDocument();
    });

    const links = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/scenarios/scen-"));
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/scenarios/scen-1");
    expect(links[1]).toHaveAttribute("href", "/scenarios/scen-2");
  });

  it("shows Back to Scenarios link", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(comparisonData),
    });

    render(<ScenarioComparisonView ids={["scen-1", "scen-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("High Prob")).toBeInTheDocument();
    });

    const backLink = screen.getByText("\u2190 Back to Scenarios");
    expect(backLink.closest("a")).toHaveAttribute("href", "/scenarios");
  });
});
