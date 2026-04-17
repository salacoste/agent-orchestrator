import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("./forecast-log.js", () => ({
  readForecastLog: vi.fn(),
}));

import { readForecastLog, type ForecastSnapshot } from "./forecast-log.js";
import { computeCalibration } from "./forecast-calibration.js";
import type { ProjectConfig } from "@composio/ao-core";

const PROJECT: ProjectConfig = {
  name: "Test",
  repo: "org/test",
  path: "/home/user/test",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
};

const mockReadForecastLog = readForecastLog as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeCalibration", () => {
  it("returns insufficientData when fewer than 2 completed forecasts", () => {
    mockReadForecastLog.mockReturnValue([
      {
        timestamp: "2026-04-01T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-11",
      },
    ] satisfies ForecastSnapshot[]);

    const result = computeCalibration(PROJECT);
    expect(result.insufficientData).toBe(true);
    expect(result.totalForecasts).toBe(1);
  });

  it("returns insufficientData when no completed forecasts", () => {
    mockReadForecastLog.mockReturnValue([
      {
        timestamp: "2026-04-01T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
      },
    ] satisfies ForecastSnapshot[]);

    const result = computeCalibration(PROJECT);
    expect(result.insufficientData).toBe(true);
    expect(result.totalForecasts).toBe(0);
  });

  it("computes correct accuracy percentages", () => {
    mockReadForecastLog.mockReturnValue([
      {
        timestamp: "2026-04-01T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-09", // before P50 → within all
      },
      {
        timestamp: "2026-04-02T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-12", // after P50 but before P80
      },
      {
        timestamp: "2026-04-03T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-18", // after P80 but before P95
      },
      {
        timestamp: "2026-04-04T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-25", // after P95
      },
    ] satisfies ForecastSnapshot[]);

    const result = computeCalibration(PROJECT);
    expect(result.insufficientData).toBe(false);
    expect(result.totalForecasts).toBe(4);

    // 1 out of 4 within P50 (the 04-09 one)
    expect(result.withinP50).toBe(1);
    expect(result.p50Accuracy).toBe(25);

    // 2 out of 4 within P80 (04-09, 04-12)
    expect(result.withinP80).toBe(2);
    expect(result.p80Accuracy).toBe(50);

    // 3 out of 4 within P95 (04-09, 04-12, 04-18)
    expect(result.withinP95).toBe(3);
    expect(result.p95Accuracy).toBe(75);
  });

  it("detects optimistic bias", () => {
    mockReadForecastLog.mockReturnValue([
      {
        timestamp: "2026-04-01T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-15", // after P50 → optimistic
      },
      {
        timestamp: "2026-04-02T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-10", p80: "2026-04-15", p95: "2026-04-20" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-18", // after P50 → optimistic
      },
    ] satisfies ForecastSnapshot[]);

    const result = computeCalibration(PROJECT);
    // Both actuals after P50 → bias = 1.0 (fully optimistic)
    expect(result.bias).toBe(1.0);
  });

  it("detects pessimistic bias", () => {
    mockReadForecastLog.mockReturnValue([
      {
        timestamp: "2026-04-01T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-20", p80: "2026-04-25", p95: "2026-04-30" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-10", // well before P50 → pessimistic
      },
      {
        timestamp: "2026-04-02T10:00:00.000Z",
        projectId: "Test",
        percentiles: { p50: "2026-04-20", p80: "2026-04-25", p95: "2026-04-30" },
        remainingStories: 5,
        simulationCount: 5000,
        actualCompletionDate: "2026-04-08", // well before P50 → pessimistic
      },
    ] satisfies ForecastSnapshot[]);

    const result = computeCalibration(PROJECT);
    // Neither actual after P50 → bias = 0 (pessimistic)
    expect(result.bias).toBe(0);
    expect(result.p50Accuracy).toBe(100);
  });
});
