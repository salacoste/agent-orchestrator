/**
 * Autopilot engine tests (Story 43.1).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createAutopilot } from "../autopilot.js";
import type { SpawnQueue } from "../spawn-queue.js";
import type { Session } from "../types.js";

// Mock fs for sprint-status.yaml reading
const mockReadFileSync = vi.fn();
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...(actual as object), readFileSync: (...args: unknown[]) => mockReadFileSync(...args) };
});

function makeSession(): Session {
  return { id: "new-agent", status: "spawning" } as Session;
}

function createMockQueue(): SpawnQueue {
  return {
    enqueue: vi.fn().mockResolvedValue(makeSession()),
    getState: vi.fn().mockResolvedValue({ pending: 0, running: 0, limit: null, entries: [] }),
    processNext: vi.fn(),
    stop: vi.fn(),
  };
}

function makeSprintStatus(stories: Record<string, string>): string {
  const entries = Object.entries(stories)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  return `development_status:\n${entries}\n`;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockReadFileSync.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutopilot", () => {
  it("off mode: story done → nothing happens", async () => {
    const queue = createMockQueue();
    const autopilot = createAutopilot({
      mode: "off",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      projectId: "proj",
    });

    await autopilot.onStoryCompleted("1-1-done");

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("autonomous mode: story done → next story found → spawn enqueued", async () => {
    const queue = createMockQueue();
    const notify = vi.fn();
    mockReadFileSync.mockReturnValue(
      makeSprintStatus({
        "epic-1": "in-progress",
        "1-1-first": "done",
        "1-2-second": "backlog",
        "1-3-third": "backlog",
      }),
    );

    const autopilot = createAutopilot({
      mode: "autonomous",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      notify,
      projectId: "proj",
    });

    await autopilot.onStoryCompleted("1-1-first");

    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ issueId: "1-2-second" }));
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("1-2-second"), "1-2-second");
  });

  it("supervised mode: story done → notification sent → timeout → queued", async () => {
    const queue = createMockQueue();
    const notify = vi.fn();
    mockReadFileSync.mockReturnValue(makeSprintStatus({ "2-1-story": "backlog" }));

    const autopilot = createAutopilot({
      mode: "supervised",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      notify,
      projectId: "proj",
      supervisedTimeoutMs: 1000, // 1s for testing
    });

    await autopilot.onStoryCompleted("1-1-done");

    // Notification sent, not spawned yet
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Approve"), "2-1-story");
    expect(queue.enqueue).not.toHaveBeenCalled();

    // After timeout → queued
    vi.advanceTimersByTime(1000);

    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ issueId: "2-1-story" }));

    const state = autopilot.getState();
    const timeoutAction = state.recentActions.find((a) => a.action === "timeout-queued");
    expect(timeoutAction).toBeDefined();

    autopilot.stop();
  });

  it("supervised mode: approve before timeout → spawns immediately", async () => {
    const queue = createMockQueue();
    mockReadFileSync.mockReturnValue(makeSprintStatus({ "3-1-story": "backlog" }));

    const autopilot = createAutopilot({
      mode: "supervised",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      projectId: "proj",
      supervisedTimeoutMs: 60_000,
    });

    await autopilot.onStoryCompleted("2-1-done");

    // Approve before timeout
    await autopilot.approveSpawn("3-1-story");

    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ issueId: "3-1-story" }));

    // Timeout should NOT trigger a second spawn
    vi.advanceTimersByTime(60_000);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);

    autopilot.stop();
  });

  it("no next story → pauses and notifies", async () => {
    const queue = createMockQueue();
    const notify = vi.fn();
    mockReadFileSync.mockReturnValue(
      makeSprintStatus({ "epic-1": "done" }), // No backlog stories
    );

    const autopilot = createAutopilot({
      mode: "autonomous",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      notify,
      projectId: "proj",
    });

    await autopilot.onStoryCompleted("1-1-done");

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(autopilot.getState().paused).toBe(true);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("no next story"), "1-1-done");
  });

  it("setMode changes mode and clears paused state", () => {
    const queue = createMockQueue();
    mockReadFileSync.mockReturnValue(makeSprintStatus({}));

    const autopilot = createAutopilot({
      mode: "off",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      projectId: "proj",
    });

    autopilot.setMode("autonomous");
    expect(autopilot.getState().mode).toBe("autonomous");

    const modeAction = autopilot.getState().recentActions[0];
    expect(modeAction.action).toBe("mode-changed");
  });

  it("getState returns mode, paused, and recent actions", async () => {
    const queue = createMockQueue();
    mockReadFileSync.mockReturnValue(makeSprintStatus({ "1-1-story": "backlog" }));

    const autopilot = createAutopilot({
      mode: "autonomous",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      projectId: "proj",
    });

    await autopilot.onStoryCompleted("0-1-done");

    const state = autopilot.getState();
    expect(state.mode).toBe("autonomous");
    expect(state.paused).toBe(false);
    expect(state.recentActions.length).toBeGreaterThan(0);
  });

  it("does not act when paused", async () => {
    const queue = createMockQueue();
    mockReadFileSync.mockReturnValue(makeSprintStatus({})); // No stories → will pause

    const autopilot = createAutopilot({
      mode: "autonomous",
      sprintStatusPath: "/tmp/sprint.yaml",
      spawnQueue: queue,
      projectId: "proj",
    });

    await autopilot.onStoryCompleted("1-1-done"); // Pauses (no next story)
    mockReadFileSync.mockReturnValue(makeSprintStatus({ "2-1-new": "backlog" }));

    await autopilot.onStoryCompleted("1-2-done"); // Should NOT act — still paused

    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
