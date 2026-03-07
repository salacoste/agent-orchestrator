import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("./sprint-health.js", () => ({
  computeSprintHealth: vi.fn(),
}));

vi.mock("./forecast.js", () => ({
  computeForecast: vi.fn(),
}));

import { computeSprintHealth, type SprintHealthResult } from "./sprint-health.js";
import { computeForecast, type SprintForecast } from "./forecast.js";
import {
  checkSprintNotifications,
  getDefaultThresholds,
  formatNotificationEvent,
} from "./sprint-notifications.js";
import type { ProjectConfig } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT = {
  root: "/tmp/test-project",
  tracker: { plugin: "bmad", outputDir: "_bmad-output" },
} as unknown as ProjectConfig;

const HEALTHY_RESULT: SprintHealthResult = {
  overall: "ok",
  indicators: [],
  stuckStories: [],
  wipColumns: [],
};

const HEALTHY_FORECAST: SprintForecast = {
  projectedCompletionDate: "2026-03-15",
  daysRemaining: 10,
  pace: "on-pace",
  confidence: 0.85,
  currentVelocity: 1.5,
  requiredVelocity: 1.4,
  remainingStories: 5,
  totalStories: 10,
  completedStories: 5,
  hasPoints: false,
};

const mockComputeSprintHealth = computeSprintHealth as ReturnType<typeof vi.fn>;
const mockComputeForecast = computeForecast as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockComputeSprintHealth.mockReturnValue(HEALTHY_RESULT);
  mockComputeForecast.mockReturnValue(HEALTHY_FORECAST);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getDefaultThresholds", () => {
  it("returns expected default values", () => {
    const defaults = getDefaultThresholds();

    expect(defaults.stuckHours).toBe(48);
    expect(defaults.wipLimit).toBe(3);
    expect(defaults.throughputDropPct).toBe(30);
    expect(defaults.forecastBehind).toBe(true);
  });
});

describe("checkSprintNotifications", () => {
  it("returns empty array when all healthy and on-pace", () => {
    const notifications = checkSprintNotifications(PROJECT);

    expect(notifications).toEqual([]);
  });

  it("generates sprint.health_warning for warning indicator", () => {
    mockComputeSprintHealth.mockReturnValue({
      ...HEALTHY_RESULT,
      indicators: [
        {
          id: "throughput-drop",
          severity: "warning",
          message: "Throughput dropped to 60% of 4-week average",
          details: ["7-day: 0.50/day", "4-week avg: 0.83/day"],
        },
      ],
    });

    const notifications = checkSprintNotifications(PROJECT);

    expect(notifications.length).toBeGreaterThanOrEqual(1);
    const warning = notifications.find((n) => n.type === "sprint.health_warning");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
    expect(warning?.title).toContain("throughput-drop");
    expect(warning?.message).toContain("Throughput dropped");
  });

  it("generates sprint.health_critical for critical indicator", () => {
    mockComputeSprintHealth.mockReturnValue({
      ...HEALTHY_RESULT,
      indicators: [
        {
          id: "stuck-stories",
          severity: "critical",
          message: "2 stories stuck for >96h",
          details: ["s1", "s2"],
        },
      ],
    });

    const notifications = checkSprintNotifications(PROJECT);

    const critical = notifications.find((n) => n.type === "sprint.health_critical");
    expect(critical).toBeDefined();
    expect(critical?.severity).toBe("critical");
    expect(critical?.title).toContain("stuck-stories");
    expect(critical?.details).toEqual(["s1", "s2"]);
  });

  it("generates sprint.story_stuck when stuck stories present", () => {
    mockComputeSprintHealth.mockReturnValue({
      ...HEALTHY_RESULT,
      stuckStories: ["s1", "s3"],
    });

    const notifications = checkSprintNotifications(PROJECT);

    const stuck = notifications.find((n) => n.type === "sprint.story_stuck");
    expect(stuck).toBeDefined();
    expect(stuck?.severity).toBe("warning");
    expect(stuck?.details).toEqual(["s1", "s3"]);
    expect(stuck?.message).toContain("2");
    expect(stuck?.message).toContain("stories");
  });

  it("generates sprint.wip_exceeded when WIP columns present", () => {
    mockComputeSprintHealth.mockReturnValue({
      ...HEALTHY_RESULT,
      wipColumns: ["in-progress", "review"],
    });

    const notifications = checkSprintNotifications(PROJECT);

    const wip = notifications.find((n) => n.type === "sprint.wip_exceeded");
    expect(wip).toBeDefined();
    expect(wip?.severity).toBe("warning");
    expect(wip?.details).toEqual(["in-progress", "review"]);
    expect(wip?.message).toContain("in-progress");
    expect(wip?.message).toContain("review");
  });

  it("generates sprint.forecast_behind when forecast behind pace", () => {
    mockComputeForecast.mockReturnValue({
      ...HEALTHY_FORECAST,
      pace: "behind",
      currentVelocity: 0.8,
      requiredVelocity: 1.5,
    });

    const notifications = checkSprintNotifications(PROJECT);

    const behind = notifications.find((n) => n.type === "sprint.forecast_behind");
    expect(behind).toBeDefined();
    expect(behind?.severity).toBe("warning");
    expect(behind?.message).toContain("0.80");
    expect(behind?.message).toContain("1.50");
    expect(behind?.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Current velocity"),
        expect.stringContaining("Required velocity"),
        expect.stringContaining("Remaining stories"),
      ]),
    );
  });

  it("does not generate forecast notification when forecastBehind=false", () => {
    mockComputeForecast.mockReturnValue({
      ...HEALTHY_FORECAST,
      pace: "behind",
      currentVelocity: 0.8,
      requiredVelocity: 1.5,
    });

    const notifications = checkSprintNotifications(PROJECT, { forecastBehind: false });

    const behind = notifications.find((n) => n.type === "sprint.forecast_behind");
    expect(behind).toBeUndefined();
  });

  it("returns multiple notifications for multiple issues", () => {
    mockComputeSprintHealth.mockReturnValue({
      overall: "critical",
      indicators: [
        {
          id: "stuck-stories",
          severity: "critical",
          message: "1 story stuck for >96h",
          details: ["s1"],
        },
        {
          id: "wip-alert",
          severity: "warning",
          message: "in-progress has 4 stories (limit: 3)",
          details: ["in-progress"],
        },
      ],
      stuckStories: ["s1"],
      wipColumns: ["in-progress"],
    });

    mockComputeForecast.mockReturnValue({
      ...HEALTHY_FORECAST,
      pace: "behind",
      currentVelocity: 0.5,
      requiredVelocity: 1.2,
    });

    const notifications = checkSprintNotifications(PROJECT);

    // Expect: 1 health_critical + 1 health_warning + 1 story_stuck + 1 wip_exceeded + 1 forecast_behind
    expect(notifications.length).toBe(5);

    const types = notifications.map((n) => n.type);
    expect(types).toContain("sprint.health_critical");
    expect(types).toContain("sprint.health_warning");
    expect(types).toContain("sprint.story_stuck");
    expect(types).toContain("sprint.wip_exceeded");
    expect(types).toContain("sprint.forecast_behind");
  });

  it("custom thresholds override defaults", () => {
    // Forecast is behind, but we disable forecastBehind notification
    mockComputeForecast.mockReturnValue({
      ...HEALTHY_FORECAST,
      pace: "behind",
      currentVelocity: 0.5,
      requiredVelocity: 1.2,
    });

    const notifications = checkSprintNotifications(PROJECT, {
      forecastBehind: false,
      stuckHours: 96,
      wipLimit: 5,
      throughputDropPct: 50,
    });

    // No forecast notification because forecastBehind=false
    const behind = notifications.find((n) => n.type === "sprint.forecast_behind");
    expect(behind).toBeUndefined();
  });
});

describe("formatNotificationEvent", () => {
  it("creates valid OrchestratorEvent structure", () => {
    const notification = {
      type: "sprint.health_warning" as const,
      severity: "warning" as const,
      title: "Sprint Health Warning: throughput-drop",
      message: "Throughput dropped to 60% of 4-week average",
      details: ["7-day: 0.50/day", "4-week avg: 0.83/day"],
      timestamp: "2026-03-04T12:00:00.000Z",
    };

    const event = formatNotificationEvent(notification);

    expect(event.id).toMatch(/^notif-/);
    expect(event.type).toBe("sprint.health_warning");
    expect(event.priority).toBe("warning");
    expect(event.sessionId).toBe("");
    expect(event.projectId).toBe("");
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.message).toContain("Sprint Health Warning");
    expect(event.message).toContain("Throughput dropped");
    expect(event.data).toEqual({
      notificationType: "sprint.health_warning",
      severity: "warning",
      title: "Sprint Health Warning: throughput-drop",
      details: ["7-day: 0.50/day", "4-week avg: 0.83/day"],
    });
  });

  it("maps critical severity to urgent priority", () => {
    const notification = {
      type: "sprint.health_critical" as const,
      severity: "critical" as const,
      title: "Sprint Health Critical: stuck-stories",
      message: "2 stories stuck for >96h",
      details: ["s1", "s2"],
      timestamp: "2026-03-04T12:00:00.000Z",
    };

    const event = formatNotificationEvent(notification);

    expect(event.priority).toBe("urgent");
  });

  it("maps info severity to info priority", () => {
    const notification = {
      type: "sprint.forecast_behind" as const,
      severity: "info" as const,
      title: "Sprint Info",
      message: "Some informational message",
      details: [],
      timestamp: "2026-03-04T12:00:00.000Z",
    };

    const event = formatNotificationEvent(notification);

    expect(event.priority).toBe("info");
  });
});
