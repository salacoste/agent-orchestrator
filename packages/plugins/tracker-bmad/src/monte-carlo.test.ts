import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";
import { computeMonteCarloForecast } from "./monte-carlo.js";
import type { ProjectConfig } from "@composio/ao-core";

const PROJECT: ProjectConfig = {
  name: "Test",
  repo: "org/test",
  path: "/home/user/test",
  defaultBranch: "main",
  sessionPrefix: "test",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
};

const STATUS_PATH = "/home/user/test/_bmad-output/sprint-status.yaml";
const HISTORY_PATH = "/home/user/test/_bmad-output/sprint-history.jsonl";

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

function setFiles(opts: { statusYaml?: string; historyLines?: string[] }) {
  mockExistsSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return true;
    if (p === HISTORY_PATH && opts.historyLines !== undefined) return true;
    return false;
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (p === STATUS_PATH && opts.statusYaml !== undefined) return opts.statusYaml;
    if (p === HISTORY_PATH && opts.historyLines !== undefined)
      return opts.historyLines.join("\n") + "\n";
    throw new Error(`Unexpected read: ${p}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

describe("computeMonteCarloForecast", () => {
  it("returns empty result when no sprint status", () => {
    const result = computeMonteCarloForecast(PROJECT);
    expect(result.percentiles.p50).toBe("");
    expect(result.histogram).toEqual([]);
    expect(result.remainingStories).toBe(0);
    expect(result.simulationCount).toBe(0);
  });

  it("returns today for all percentiles when no remaining stories", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: done",
        "  s2:",
        "    status: done",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeMonteCarloForecast(PROJECT);
    const today = new Date().toISOString().slice(0, 10);
    expect(result.percentiles.p50).toBe(today);
    expect(result.percentiles.p80).toBe(today);
    expect(result.percentiles.p95).toBe(today);
    expect(result.remainingStories).toBe(0);
    expect(result.histogram.length).toBe(1);
    expect(result.histogram[0]!.probability).toBe(1.0);
  });

  it("returns empty result when no history completions", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeMonteCarloForecast(PROJECT);
    expect(result.percentiles.p50).toBe("");
    expect(result.remainingStories).toBe(2);
    expect(result.simulationCount).toBe(0);
  });

  it("produces deterministic percentiles with fixed random", () => {
    // 3 remaining stories, history shows 1 completion per day on weekdays
    const historyLines: string[] = [];
    for (let i = 1; i <= 5; i++) {
      historyLines.push(
        JSON.stringify({
          timestamp: `2026-02-0${i}T10:00:00.000Z`,
          storyId: `done${i}`,
          fromStatus: "in-progress",
          toStatus: "done",
        }),
      );
    }

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
        "  s3:",
        "    status: review",
        "  done1:",
        "    status: done",
        "  done2:",
        "    status: done",
        "  done3:",
        "    status: done",
        "  done4:",
        "    status: done",
        "  done5:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 100,
      randomFn: () => 0.5,
      excludeWeekends: false,
    });

    expect(result.remainingStories).toBe(3);
    expect(result.simulationCount).toBe(100);
    expect(result.sampleSize).toBeGreaterThan(0);
    expect(result.percentiles.p50).toBeTruthy();
    expect(result.percentiles.p80).toBeTruthy();
    expect(result.percentiles.p95).toBeTruthy();

    // With randomFn=0.5, all simulations should pick the same throughput
    // so all percentiles should be the same date
    expect(result.percentiles.p50).toBe(result.percentiles.p80);
    expect(result.percentiles.p80).toBe(result.percentiles.p95);
  });

  it("excludes weekends when configured", () => {
    // Create history on a Monday and Tuesday
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z", // Monday
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
      JSON.stringify({
        timestamp: "2026-03-03T10:00:00.000Z", // Tuesday
        storyId: "done2",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  done1:",
        "    status: done",
        "  done2:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const resultWithWeekends = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 100,
      randomFn: () => 0.5,
      excludeWeekends: false,
    });

    const resultWithoutWeekends = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 100,
      randomFn: () => 0.5,
      excludeWeekends: true,
    });

    // Both should produce valid results
    expect(resultWithWeekends.percentiles.p50).toBeTruthy();
    expect(resultWithoutWeekends.percentiles.p50).toBeTruthy();
    expect(resultWithWeekends.sampleSize).toBe(resultWithoutWeekends.sampleSize);
  });

  it("filters by epic", () => {
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z",
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "    epic: epic-auth",
        "  s2:",
        "    status: backlog",
        "    epic: epic-ui",
        "  done1:",
        "    status: done",
        "    epic: epic-auth",
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, "epic-auth", {
      simulations: 50,
      randomFn: () => 0.5,
      excludeWeekends: false,
    });

    expect(result.remainingStories).toBe(1);
  });

  it("caps simulation at 365 days", () => {
    // Create history with very low throughput (all zeros except one completion)
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z",
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        // 100 remaining stories
        ...Array.from({ length: 100 }, (_, i) => `  s${i + 1}:\n    status: backlog`),
        "  done1:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    // With randomFn=0.99, we sample the last element (which in a single-date history is still throughput=1)
    // but with 100 stories it should eventually complete (within 365 days)
    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 10,
      randomFn: () => 0.99,
      excludeWeekends: false,
    });

    expect(result.simulationCount).toBe(10);
    // All percentiles should be defined
    expect(result.percentiles.p50).toBeTruthy();
    // Verify the 365-day cap: all percentile dates are within 365 days of today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const maxDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    const maxDateStr = maxDate.toISOString().slice(0, 10);
    expect(result.percentiles.p50 <= maxDateStr).toBe(true);
    expect(result.percentiles.p80 <= maxDateStr).toBe(true);
    expect(result.percentiles.p95 <= maxDateStr).toBe(true);
  });

  it("histogram probabilities sum approximately to 1.0", () => {
    const historyLines: string[] = [];
    for (let i = 1; i <= 3; i++) {
      historyLines.push(
        JSON.stringify({
          timestamp: `2026-02-0${i}T10:00:00.000Z`,
          storyId: `done${i}`,
          fromStatus: "in-progress",
          toStatus: "done",
        }),
      );
    }

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
        "  done1:",
        "    status: done",
        "  done2:",
        "    status: done",
        "  done3:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 500,
      excludeWeekends: false,
    });

    if (result.histogram.length > 0) {
      const totalProb = result.histogram.reduce((sum, b) => sum + b.probability, 0);
      expect(totalProb).toBeCloseTo(1.0, 1);
      // Last cumulative should be approximately 1.0
      const lastBucket = result.histogram[result.histogram.length - 1]!;
      expect(lastBucket.cumulative).toBeCloseTo(1.0, 1);
    }
  });

  it("sampleSize matches actual throughput distribution size", () => {
    // 3 days of history (Mon-Wed), 1 completion each day
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z", // Mon
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
      JSON.stringify({
        timestamp: "2026-03-03T10:00:00.000Z", // Tue
        storyId: "done2",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
      JSON.stringify({
        timestamp: "2026-03-04T10:00:00.000Z", // Wed
        storyId: "done3",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  done1:",
        "    status: done",
        "  done2:",
        "    status: done",
        "  done3:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 50,
      excludeWeekends: false,
    });

    // 3 days Mon-Wed with excludeWeekends=false → sampleSize = 3
    expect(result.sampleSize).toBe(3);

    const resultNoWeekends = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 50,
      excludeWeekends: true,
    });

    // Mon-Wed are weekdays, so sampleSize should still be 3
    expect(resultNoWeekends.sampleSize).toBe(3);
  });

  it("completes 10,000 iterations within 5 seconds (NFR-E2-1)", () => {
    // Build realistic throughput: 30 days of history with fixed varying completions
    const historyLines: string[] = [];
    const dailyCounts = [
      2, 1, 3, 1, 2, 0, 1, 3, 2, 1, 1, 2, 3, 0, 1, 2, 1, 3, 2, 1, 0, 2, 1, 3, 2, 1, 1, 2, 3, 1,
    ];
    let doneIdx = 0;
    for (let i = 0; i < dailyCounts.length; i++) {
      const day = i + 1;
      for (let j = 0; j < dailyCounts[i]!; j++) {
        historyLines.push(
          JSON.stringify({
            timestamp: `2026-03-${String(day).padStart(2, "0")}T10:00:00.000Z`,
            storyId: `done-${doneIdx++}`,
            fromStatus: "in-progress",
            toStatus: "done",
          }),
        );
      }
    }

    setFiles({
      statusYaml: [
        "development_status:",
        ...Array.from({ length: 50 }, (_, i) => `  s${i + 1}:\n    status: backlog`),
        ...Array.from({ length: doneIdx }, (_, i) => `  done-${i}:\n    status: done`),
      ].join("\n"),
      historyLines,
    });

    const start = performance.now();
    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 10_000,
      excludeWeekends: false,
    });
    const elapsed = performance.now() - start;

    expect(result.simulationCount).toBe(10_000);
    expect(elapsed).toBeLessThan(5000);
  });

  it("returns insufficientData=true when no throughput data", () => {
    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
      ].join("\n"),
      historyLines: [],
    });

    const result = computeMonteCarloForecast(PROJECT);
    expect(result.insufficientData).toBe(true);
    expect(result.remainingStories).toBe(2);
  });

  it("returns insufficientData=false when throughput data exists", () => {
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z",
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  done1:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 10,
      randomFn: () => 0.5,
      excludeWeekends: false,
    });
    expect(result.insufficientData).toBe(false);
  });

  it("cumulative probabilities are monotonically increasing", () => {
    const historyLines: string[] = [];
    for (let i = 1; i <= 5; i++) {
      historyLines.push(
        JSON.stringify({
          timestamp: `2026-03-0${i}T10:00:00.000Z`,
          storyId: `done${i}`,
          fromStatus: "in-progress",
          toStatus: "done",
        }),
      );
    }

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  s2:",
        "    status: in-progress",
        "  s3:",
        "    status: review",
        ...Array.from({ length: 5 }, (_, i) => `  done${i + 1}:\n    status: done`),
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 500,
      excludeWeekends: false,
    });

    for (let i = 1; i < result.histogram.length; i++) {
      expect(result.histogram[i]!.cumulative).toBeGreaterThanOrEqual(
        result.histogram[i - 1]!.cumulative - 0.001,
      );
    }
  });

  it("excludes weekends correctly starting from different days", () => {
    // 2026-03-06 is Friday, 2026-03-07 is Saturday, 2026-03-08 is Sunday
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z", // Monday
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
      JSON.stringify({
        timestamp: "2026-03-06T10:00:00.000Z", // Friday
        storyId: "done2",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  done1:",
        "    status: done",
        "  done2:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const resultWithWeekends = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 100,
      randomFn: () => 0.5,
      excludeWeekends: false,
    });
    const resultNoWeekends = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 100,
      randomFn: () => 0.5,
      excludeWeekends: true,
    });

    // Both should produce valid results
    expect(resultWithWeekends.percentiles.p50).toBeTruthy();
    expect(resultNoWeekends.percentiles.p50).toBeTruthy();
    // Excluding weekends should push dates later or equal (fewer working days)
    expect(resultNoWeekends.percentiles.p50 >= resultWithWeekends.percentiles.p50).toBe(true);
  });

  it("epic filter with non-existent epic returns empty result", () => {
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z",
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  done1:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, "non-existent-epic", {
      simulations: 10,
      randomFn: () => 0.5,
      excludeWeekends: false,
    });

    expect(result.remainingStories).toBe(0);
    expect(result.insufficientData).toBe(true);
  });

  it("filters throughput to window when throughputWindowDays is set", () => {
    // 30 days of history, each day has 1 completion
    const historyLines: string[] = [];
    for (let i = 1; i <= 30; i++) {
      historyLines.push(
        JSON.stringify({
          timestamp: `2026-03-${String(i).padStart(2, "0")}T10:00:00.000Z`,
          storyId: `done${i}`,
          fromStatus: "in-progress",
          toStatus: "done",
        }),
      );
    }

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        ...Array.from({ length: 30 }, (_, i) => `  done${i + 1}:\n    status: done`),
      ].join("\n"),
      historyLines,
    });

    // Without window: all 30 days
    const fullResult = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 50,
      randomFn: () => 0.5,
      excludeWeekends: false,
    });
    expect(fullResult.sampleSize).toBe(30);

    // With window of 14: only last 14 days
    const windowedResult = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 50,
      randomFn: () => 0.5,
      excludeWeekends: false,
      throughputWindowDays: 14,
    });
    expect(windowedResult.sampleSize).toBe(14);
  });

  it("does not filter throughput when window exceeds available data", () => {
    const historyLines: string[] = [
      JSON.stringify({
        timestamp: "2026-03-02T10:00:00.000Z",
        storyId: "done1",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
      JSON.stringify({
        timestamp: "2026-03-03T10:00:00.000Z",
        storyId: "done2",
        fromStatus: "in-progress",
        toStatus: "done",
      }),
    ];

    setFiles({
      statusYaml: [
        "development_status:",
        "  s1:",
        "    status: backlog",
        "  done1:",
        "    status: done",
        "  done2:",
        "    status: done",
      ].join("\n"),
      historyLines,
    });

    const result = computeMonteCarloForecast(PROJECT, undefined, {
      simulations: 50,
      randomFn: () => 0.5,
      excludeWeekends: false,
      throughputWindowDays: 14, // window > 2 days available
    });

    // Should use all available data (2 days), not truncate
    expect(result.sampleSize).toBe(2);
  });
});
