/**
 * Tests for EventBus Backlog Monitor — queue depth alerting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventBusBacklogMonitor } from "../eventbus-backlog-monitor.js";
import type { EventBus } from "../types.js";

function createMockEventBus(queueSize = 0): EventBus {
  return {
    name: "mock-event-bus",
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(() => {}),
    isConnected: vi.fn().mockReturnValue(true),
    isDegraded: vi.fn().mockReturnValue(false),
    getQueueSize: vi.fn().mockReturnValue(queueSize),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("EventBusBacklogMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires alert when queue depth exceeds threshold", () => {
    const onAlert = vi.fn();
    const bus = createMockEventBus(150);
    const monitor = createEventBusBacklogMonitor({
      backlogThreshold: 100,
      checkIntervalMs: 1000,
      onAlert,
    });

    monitor.start(bus);

    // Advance past one interval
    vi.advanceTimersByTime(1000);

    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith(150);

    monitor.stop();
  });

  it("does not fire alert when queue is below threshold", () => {
    const onAlert = vi.fn();
    const bus = createMockEventBus(50);
    const monitor = createEventBusBacklogMonitor({
      backlogThreshold: 100,
      checkIntervalMs: 1000,
      onAlert,
    });

    monitor.start(bus);
    vi.advanceTimersByTime(5000);

    expect(onAlert).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("deduplicates alerts — fires only once per breach", () => {
    const onAlert = vi.fn();
    const bus = createMockEventBus(150);
    const monitor = createEventBusBacklogMonitor({
      backlogThreshold: 100,
      checkIntervalMs: 1000,
      onAlert,
    });

    monitor.start(bus);

    // Multiple intervals while queue stays above threshold
    vi.advanceTimersByTime(5000);

    // Should fire only once despite 5 checks
    expect(onAlert).toHaveBeenCalledTimes(1);

    monitor.stop();
  });

  it("re-arms alert after queue drops below threshold", () => {
    const onAlert = vi.fn();
    const bus = createMockEventBus(150);
    const getQueueSizeMock = bus.getQueueSize as ReturnType<typeof vi.fn>;

    const monitor = createEventBusBacklogMonitor({
      backlogThreshold: 100,
      checkIntervalMs: 1000,
      onAlert,
    });

    monitor.start(bus);

    // First breach
    vi.advanceTimersByTime(1000);
    expect(onAlert).toHaveBeenCalledTimes(1);

    // Queue drops below threshold
    getQueueSizeMock.mockReturnValue(50);
    vi.advanceTimersByTime(1000);
    expect(onAlert).toHaveBeenCalledTimes(1); // No new alert

    // Queue rises above threshold again
    getQueueSizeMock.mockReturnValue(200);
    vi.advanceTimersByTime(1000);
    expect(onAlert).toHaveBeenCalledTimes(2);
    expect(onAlert).toHaveBeenLastCalledWith(200);

    monitor.stop();
  });

  it("stop cleans up interval", () => {
    const onAlert = vi.fn();
    const bus = createMockEventBus(150);
    const monitor = createEventBusBacklogMonitor({
      backlogThreshold: 100,
      checkIntervalMs: 1000,
      onAlert,
    });

    monitor.start(bus);
    vi.advanceTimersByTime(1000);
    expect(onAlert).toHaveBeenCalledTimes(1);

    monitor.stop();

    // No more alerts after stop
    vi.advanceTimersByTime(5000);
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  it("getBacklogSize returns last polled size", () => {
    const bus = createMockEventBus(42);
    const monitor = createEventBusBacklogMonitor({
      backlogThreshold: 100,
      checkIntervalMs: 1000,
      onAlert: vi.fn(),
    });

    expect(monitor.getBacklogSize()).toBe(0); // Before start

    monitor.start(bus);
    vi.advanceTimersByTime(1000);

    expect(monitor.getBacklogSize()).toBe(42);

    monitor.stop();
  });
});
