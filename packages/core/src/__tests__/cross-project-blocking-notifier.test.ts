/**
 * Tests for cross-project dependency blocking notifier (Story 51.5).
 * @module cross-project-blocking-notifier.test
 */

import { describe, it, expect, vi } from "vitest";
import { checkAndNotifyBlockingDeps } from "../cross-project-blocking-notifier.js";
import type { BlockingTimesStore } from "../cross-project-blocking-times.js";
import type {
  DependencyWithStatus,
  DependencyBlockingAlert,
  SprintDataMap,
} from "../cross-project-deps.js";

// =============================================================================
// HELPERS
// =============================================================================

const makeDep = (
  id: string,
  sourceProjectId: string,
  sourceStoryId: string,
  targetProjectId: string,
  targetStoryId: string,
): DependencyWithStatus => ({
  id,
  sourceProjectId,
  sourceStoryId,
  targetProjectId,
  targetStoryId,
  createdAt: "2026-03-30T10:00:00.000Z",
  targetStatus: "in-progress",
  isResolved: false,
});

const createMockEventBus = () => ({
  publish: vi.fn(),
});

const createMockStore = (_times: Record<string, string> = {}): BlockingTimesStore => ({
  load: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
});

function makeAlert(
  dep: DependencyWithStatus,
  overrides: Partial<DependencyBlockingAlert> = {},
): DependencyBlockingAlert {
  return {
    dep,
    blockedStoryId: dep.sourceStoryId,
    blockedProjectId: dep.sourceProjectId,
    blockingStoryId: dep.targetStoryId,
    blockingProjectId: dep.targetProjectId,
    blockingDurationMs: 7_200_000,
    blockingDurationLabel: "2h",
    thresholdExceeded: true,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("checkAndNotifyBlockingDeps", () => {
  const fixedNow = new Date("2026-03-30T12:00:00.000Z");
  const oneHour = 3_600_000;

  it("emits events for threshold-exceeded deps", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
    };
    const startTimes = { "dep-1": "2026-03-30T10:00:00.000Z" };
    const eventBus = createMockEventBus();
    const store = createMockStore(startTimes);

    store.refresh = vi.fn().mockReturnValue({
      times: startTimes,
      alerts: [makeAlert(dep)],
    });

    const result = checkAndNotifyBlockingDeps(
      [dep],
      sprintData,
      store,
      eventBus,
      oneHour,
      fixedNow,
    );

    expect(store.refresh).toHaveBeenCalledWith([dep], sprintData, oneHour, fixedNow);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "dependency.blocking",
        priority: "warning",
        timestamp: fixedNow.toISOString(),
        data: expect.objectContaining({
          depId: "dep-1",
          sourceProjectId: "proj-a",
          sourceStoryId: "story-1",
          targetProjectId: "proj-b",
          targetStoryId: "story-2",
          blockingDurationMs: 7_200_000,
          blockingDurationLabel: "2h",
          thresholdExceeded: true,
        }),
      }),
    );
    expect(result.published).toHaveLength(1);
    expect(result.published[0]!.dep.id).toBe("dep-1");
    expect(result.alerts).toHaveLength(1);
  });

  it("skips deps below threshold", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
    };
    const startTimes = { "dep-1": "2026-03-30T11:30:00.000Z" };
    const eventBus = createMockEventBus();
    const store = createMockStore(startTimes);

    store.refresh = vi.fn().mockReturnValue({
      times: startTimes,
      alerts: [
        makeAlert(dep, {
          blockingDurationMs: 1_800_000,
          blockingDurationLabel: "30m",
          thresholdExceeded: false,
        }),
      ],
    });

    const result = checkAndNotifyBlockingDeps(
      [dep],
      sprintData,
      store,
      eventBus,
      oneHour,
      fixedNow,
    );

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(result.published).toHaveLength(0);
  });

  it("skips resolved deps", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "done" } },
    };
    const eventBus = createMockEventBus();
    const store = createMockStore({});

    store.refresh = vi.fn().mockReturnValue({ times: {}, alerts: [] });

    checkAndNotifyBlockingDeps([dep], sprintData, store, eventBus, oneHour, fixedNow);

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("continues on publish failure — best-effort", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
    };
    const startTimes = { "dep-1": "2026-03-30T10:00:00.000Z" };
    const eventBus = createMockEventBus();
    const store = createMockStore(startTimes);

    eventBus.publish.mockImplementation(() => {
      throw new Error("Publish failed");
    });

    store.refresh = vi.fn().mockReturnValue({
      times: startTimes,
      alerts: [makeAlert(dep)],
    });

    const result = checkAndNotifyBlockingDeps(
      [dep],
      sprintData,
      store,
      eventBus,
      oneHour,
      fixedNow,
    );

    // publish threw, so alert was never added to published list
    expect(result.published).toHaveLength(0);
  });

  it("handles multiple deps — emits for each exceeded dep", () => {
    const dep1 = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const dep2 = makeDep("dep-2", "proj-a", "story-3", "proj-c", "story-4");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
      "proj-c": { development_status: { "story-4": "in-progress" } },
    };
    const startTimes = {
      "dep-1": "2026-03-30T10:00:00.000Z",
      "dep-2": "2026-03-30T10:00:00.000Z",
    };
    const eventBus = createMockEventBus();
    const store = createMockStore(startTimes);

    store.refresh = vi.fn().mockReturnValue({
      times: startTimes,
      alerts: [
        makeAlert(dep1, { thresholdExceeded: true }),
        makeAlert(dep2, { thresholdExceeded: true }),
      ],
    });

    const result = checkAndNotifyBlockingDeps(
      [dep1, dep2],
      sprintData,
      store,
      eventBus,
      oneHour,
      fixedNow,
    );

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(result.published).toHaveLength(2);
    // Verify each published alert has the correct dep
    expect(result.published[0]!.dep.id).toBe("dep-1");
    expect(result.published[1]!.dep.id).toBe("dep-2");
  });

  it("returns empty alerts for empty deps list", () => {
    const eventBus = createMockEventBus();
    const store = createMockStore({});

    store.refresh = vi.fn().mockReturnValue({ times: {}, alerts: [] });

    const result = checkAndNotifyBlockingDeps([], {}, store, eventBus, oneHour, fixedNow);

    expect(result.alerts).toHaveLength(0);
    expect(result.published).toHaveLength(0);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("handles mixed threshold — only publishes exceeded alerts", () => {
    const dep1 = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const dep2 = makeDep("dep-2", "proj-a", "story-3", "proj-c", "story-4");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
      "proj-c": { development_status: { "story-4": "in-progress" } },
    };
    const startTimes = {
      "dep-1": "2026-03-30T10:00:00.000Z",
      "dep-2": "2026-03-30T11:30:00.000Z",
    };
    const eventBus = createMockEventBus();
    const store = createMockStore(startTimes);

    store.refresh = vi.fn().mockReturnValue({
      times: startTimes,
      alerts: [
        makeAlert(dep1, { thresholdExceeded: true }),
        makeAlert(dep2, {
          blockingDurationMs: 1_800_000,
          blockingDurationLabel: "30m",
          thresholdExceeded: false,
        }),
      ],
    });

    const result = checkAndNotifyBlockingDeps(
      [dep1, dep2],
      sprintData,
      store,
      eventBus,
      oneHour,
      fixedNow,
    );

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(result.alerts).toHaveLength(2);
    expect(result.published).toHaveLength(1);
    expect(result.published[0]!.dep.id).toBe("dep-1");
  });

  it("uses current time when now parameter is omitted", () => {
    const dep = makeDep("dep-1", "proj-a", "story-1", "proj-b", "story-2");
    const sprintData: SprintDataMap = {
      "proj-b": { development_status: { "story-2": "in-progress" } },
    };
    const startTimes = { "dep-1": "2026-03-30T10:00:00.000Z" };
    const eventBus = createMockEventBus();
    const store = createMockStore(startTimes);

    store.refresh = vi.fn().mockReturnValue({
      times: startTimes,
      alerts: [makeAlert(dep)],
    });

    checkAndNotifyBlockingDeps(
      [dep],
      sprintData,
      store,
      eventBus,
      oneHour,
      // now parameter intentionally omitted
    );

    expect(store.refresh).toHaveBeenCalledWith([dep], sprintData, oneHour, undefined);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    // Verify timestamp in event is a valid ISO string (from current time)
    const publishedEvent = eventBus.publish.mock.calls[0]![0] as { timestamp: string };
    expect(typeof publishedEvent.timestamp).toBe("string");
    expect(publishedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
