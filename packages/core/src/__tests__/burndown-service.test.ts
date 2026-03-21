/**
 * Tests for Story 2-4: Sprint Burndown Recalculation.
 *
 * Covers:
 * - 4.1 Burndown calculation with known story data
 * - 4.2 Ideal burndown line calculation (linear decline)
 * - 4.3 Event-driven recalculation (story.completed → burndown updated)
 * - 4.4 Graceful degradation (missing YAML, malformed data)
 * - 4.5 Story points mode vs count mode
 * - 4.6 Sprint date configuration (explicit dates vs no dates)
 * - 4.7 Empty sprint (no stories) returns valid empty result
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify } from "yaml";
import { createBurndownService } from "../burndown-service.js";
import type { EventBusEvent } from "../types.js";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "burndown-test-"));
}

function writeSprintStatus(dir: string, data: Record<string, unknown>): void {
  writeFileSync(join(dir, "sprint-status.yaml"), stringify(data), "utf-8");
}

function makeStoryCompletedEvent(storyId: string): EventBusEvent {
  return {
    eventId: "test-event-1",
    eventType: "story.completed",
    timestamp: new Date().toISOString(),
    metadata: { storyId },
  };
}

describe("BurndownService", () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = createTempDir();
  });

  // 4.1 Burndown calculation with known story data
  describe("burndown calculation with known data", () => {
    it("should calculate correct counts for 3 stories (1 done, 2 remaining)", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
          "1-3-story-c": "backlog",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalStories).toBe(3);
      expect(result.completedStories).toBe(1);
      expect(result.remainingStories).toBe(2);
      expect(result.completionPercentage).toBeCloseTo(33.33, 1);
    });

    it("should calculate 100% when all stories are done", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "done",
          "1-3-story-c": "done",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalStories).toBe(3);
      expect(result.completedStories).toBe(3);
      expect(result.remainingStories).toBe(0);
      expect(result.completionPercentage).toBe(100);
    });

    it("should exclude epic and retrospective entries from story count", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "epic-1": "in-progress",
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
          "epic-1-retrospective": "optional",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalStories).toBe(2);
      expect(result.completedStories).toBe(1);
    });
  });

  // 4.2 Ideal burndown line calculation
  describe("ideal burndown line", () => {
    it("should generate linear decline from total to 0 over sprint duration", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "backlog",
          "1-2-story-b": "backlog",
          "1-3-story-c": "backlog",
          "1-4-story-d": "backlog",
        },
      });

      const service = createBurndownService({
        projectPath,
        sprintStartDate: "2026-03-01",
        sprintEndDate: "2026-03-11",
      });
      const result = service.getResult();

      expect(result.sprintStart).toBe("2026-03-01");
      expect(result.sprintEnd).toBe("2026-03-11");
      expect(result.dailyData.length).toBe(11); // 10 days + day 0

      // First day: ideal remaining = total stories
      expect(result.dailyData[0].idealRemaining).toBe(4);
      expect(result.dailyData[0].date).toBe("2026-03-01");

      // Last day: ideal remaining = 0
      const lastPoint = result.dailyData[result.dailyData.length - 1];
      expect(lastPoint.idealRemaining).toBe(0);
      expect(lastPoint.date).toBe("2026-03-11");

      // Midpoint: ideal remaining ≈ half
      const midPoint = result.dailyData[5];
      expect(midPoint.idealRemaining).toBe(2);
    });

    it("should fall back to single data point when no sprint dates provided", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.sprintStart).toBeNull();
      expect(result.sprintEnd).toBeNull();
      expect(result.dailyData.length).toBe(1);
      expect(result.dailyData[0].remaining).toBe(1);
      expect(result.dailyData[0].completed).toBe(1);
    });
  });

  // 4.3 Event-driven recalculation
  describe("event-driven recalculation", () => {
    it("should recalculate burndown when onStoryCompleted is called", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "in-progress",
          "1-2-story-b": "backlog",
        },
      });

      const service = createBurndownService({ projectPath });
      const initialResult = service.getResult();
      expect(initialResult.completedStories).toBe(0);

      // Simulate story completion by updating YAML and firing event
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "backlog",
        },
      });

      await service.onStoryCompleted(makeStoryCompletedEvent("1-1-story-a"));

      const updatedResult = service.getResult();
      expect(updatedResult.completedStories).toBe(1);
      expect(updatedResult.remainingStories).toBe(1);
      expect(updatedResult.completionPercentage).toBe(50);
    });

    it("should update lastUpdated timestamp on recalculation", async () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "in-progress",
        },
      });

      const service = createBurndownService({ projectPath });
      const initialTimestamp = service.getResult().lastUpdated;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
        },
      });

      await service.onStoryCompleted(makeStoryCompletedEvent("1-1-story-a"));
      const updatedTimestamp = service.getResult().lastUpdated;

      expect(updatedTimestamp).not.toBe(initialTimestamp);
    });

    it("should return cached result from getResult without re-reading YAML", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
        },
      });

      const service = createBurndownService({ projectPath });
      const result1 = service.getResult();
      const result2 = service.getResult();

      // Same object reference — cached, not recalculated
      expect(result1).toBe(result2);
    });

    it("should return fresh result from recalculate()", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
        },
      });

      const service = createBurndownService({ projectPath });
      const result1 = service.getResult();

      // Manually recalculate — returns new object
      const result2 = service.recalculate();

      expect(result1).not.toBe(result2);
      expect(result2.totalStories).toBe(2);
    });
  });

  // 4.4 Graceful degradation
  describe("graceful degradation", () => {
    it("should return empty result when sprint-status.yaml is missing", () => {
      // No sprint-status.yaml written
      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalStories).toBe(0);
      expect(result.completedStories).toBe(0);
      expect(result.remainingStories).toBe(0);
      expect(result.completionPercentage).toBe(0);
      expect(result.currentPace).toBe("no-data");
      expect(result.dailyData).toEqual([]);
    });

    it("should return empty result when development_status is missing", () => {
      writeSprintStatus(projectPath, {
        project: "test",
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalStories).toBe(0);
      expect(result.completedStories).toBe(0);
    });

    it("should handle malformed YAML without crashing", () => {
      writeFileSync(join(projectPath, "sprint-status.yaml"), "{{{{bad yaml", "utf-8");

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      // Should return empty/default result, not throw
      expect(result.totalStories).toBe(0);
    });

    it("should not crash when onStoryCompleted is called with missing YAML", async () => {
      const service = createBurndownService({ projectPath });

      // Should not throw
      await service.onStoryCompleted(makeStoryCompletedEvent("nonexistent-story"));

      const result = service.getResult();
      expect(result.totalStories).toBe(0);
    });
  });

  // 4.5 Story points mode vs count mode
  describe("story points mode", () => {
    it("should include point totals when priorities map has numeric values", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
          "1-3-story-c": "backlog",
        },
        priorities: {
          "1-1-story-a": 3,
          "1-2-story-b": 5,
          "1-3-story-c": 2,
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalPoints).toBe(10);
      expect(result.completedPoints).toBe(3);
      expect(result.remainingPoints).toBe(7);
    });

    it("should omit point fields when no priorities map exists", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalPoints).toBeUndefined();
      expect(result.completedPoints).toBeUndefined();
      expect(result.remainingPoints).toBeUndefined();
    });

    it("should handle mixed priorities (some stories have points, others do not)", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
          "1-3-story-c": "backlog",
        },
        priorities: {
          "1-1-story-a": 3,
          // 1-2 and 1-3 have no point values
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      // Should still report points for what's available
      expect(result.totalPoints).toBe(3);
      expect(result.completedPoints).toBe(3);
      expect(result.remainingPoints).toBe(0);
    });

    it("should ignore non-numeric priority values", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
        },
        priorities: {
          "1-1-story-a": "high",
          "1-2-story-b": "low",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      // No numeric priorities found → no points fields
      expect(result.totalPoints).toBeUndefined();
      expect(result.completedPoints).toBeUndefined();
    });
  });

  // 4.6 Sprint date configuration
  describe("sprint date configuration", () => {
    it("should use explicit sprint dates when provided", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
        },
      });

      const service = createBurndownService({
        projectPath,
        sprintStartDate: "2026-03-01",
        sprintEndDate: "2026-03-15",
      });
      const result = service.getResult();

      expect(result.sprintStart).toBe("2026-03-01");
      expect(result.sprintEnd).toBe("2026-03-15");
      expect(result.dailyData.length).toBeGreaterThan(1);
    });

    it("should report null sprint dates when not configured", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.sprintStart).toBeNull();
      expect(result.sprintEnd).toBeNull();
    });
  });

  // 4.7 Empty sprint
  describe("empty sprint", () => {
    it("should return valid empty result when no stories exist", () => {
      writeSprintStatus(projectPath, {
        development_status: {},
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalStories).toBe(0);
      expect(result.completedStories).toBe(0);
      expect(result.remainingStories).toBe(0);
      expect(result.completionPercentage).toBe(0);
      expect(result.currentPace).toBe("no-data");
    });

    it("should return valid result when only epics exist (no stories)", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "epic-1": "in-progress",
          "epic-2": "backlog",
          "epic-1-retrospective": "optional",
        },
      });

      const service = createBurndownService({ projectPath });
      const result = service.getResult();

      expect(result.totalStories).toBe(0);
      expect(result.completedStories).toBe(0);
    });
  });

  // Additional: pace detection
  describe("pace detection", () => {
    it("should report no-data when no stories exist", () => {
      writeSprintStatus(projectPath, {
        development_status: {},
      });

      const service = createBurndownService({ projectPath });
      expect(service.getResult().currentPace).toBe("no-data");
    });

    it("should report no-data when no sprint dates are configured", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
        },
      });

      const service = createBurndownService({ projectPath });
      expect(service.getResult().currentPace).toBe("no-data");
    });

    it("should report ahead when all stories done before sprint end", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "done",
        },
      });

      // Sprint in the future — all done already
      const service = createBurndownService({
        projectPath,
        sprintStartDate: "2025-01-01",
        sprintEndDate: "2027-12-31",
      });

      expect(service.getResult().currentPace).toBe("ahead");
    });

    it("should report behind when sprint ended with incomplete stories", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "done",
          "1-2-story-b": "in-progress",
          "1-3-story-c": "backlog",
        },
      });

      // Sprint already ended — not all stories done
      const service = createBurndownService({
        projectPath,
        sprintStartDate: "2025-01-01",
        sprintEndDate: "2025-01-14",
      });

      expect(service.getResult().currentPace).toBe("behind");
    });

    it("should report on-pace when sprint has not started yet", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-story-a": "backlog",
          "1-2-story-b": "backlog",
        },
      });

      // Sprint far in the future — hasn't started yet
      const service = createBurndownService({
        projectPath,
        sprintStartDate: "2099-01-01",
        sprintEndDate: "2099-01-14",
      });

      expect(service.getResult().currentPace).toBe("on-pace");
    });
  });

  // Additional: isStoryKey filtering
  describe("story key filtering", () => {
    it("should match keys with N-N- pattern as stories", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "2-1-first-story": "done",
          "2-2-second-story": "in-progress",
          "10-3-big-number": "backlog",
        },
      });

      const service = createBurndownService({ projectPath });
      expect(service.getResult().totalStories).toBe(3);
    });

    it("should not count epic entries as stories", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "epic-1": "done",
          "epic-2": "in-progress",
          "1-1-real-story": "done",
        },
      });

      const service = createBurndownService({ projectPath });
      expect(service.getResult().totalStories).toBe(1);
    });

    it("should not count retrospective entries as stories", () => {
      writeSprintStatus(projectPath, {
        development_status: {
          "1-1-real-story": "done",
          "epic-1-retrospective": "done",
        },
      });

      const service = createBurndownService({ projectPath });
      expect(service.getResult().totalStories).toBe(1);
    });
  });
});
