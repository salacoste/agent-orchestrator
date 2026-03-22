/**
 * Spawn queue tests (Story 43.3).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSpawnQueue } from "../spawn-queue.js";
import { clearServiceRegistry } from "../service-registry.js";
import type { Session, SessionSpawnConfig, SessionManager } from "../types.js";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "agent-1",
    projectId: "proj",
    status: "working",
    activity: null,
    branch: null,
    issueId: null,
    pr: null,
    workspacePath: null,
    runtimeHandle: null,
    agentInfo: null,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    metadata: {},
    ...overrides,
  };
}

function createMockSessionManager(runningSessions: Session[] = []): SessionManager {
  return {
    list: vi.fn().mockResolvedValue(runningSessions),
    spawn: vi.fn().mockResolvedValue(makeSession({ id: "new-agent" })),
    get: vi.fn(),
    kill: vi.fn(),
    restore: vi.fn(),
    send: vi.fn(),
    cleanup: vi.fn(),
    spawnOrchestrator: vi.fn(),
  } as unknown as SessionManager;
}

beforeEach(() => {
  clearServiceRegistry();
});

describe("createSpawnQueue", () => {
  it("spawns immediately when no WIP limit set", async () => {
    const sm = createMockSessionManager();
    const queue = createSpawnQueue({ sessionManager: sm });

    const config: SessionSpawnConfig = { projectId: "proj", issueId: "S-1" } as SessionSpawnConfig;
    const session = await queue.enqueue(config);

    expect(session.id).toBe("new-agent");
    expect(sm.spawn).toHaveBeenCalledWith(config);
  });

  it("spawns immediately when under WIP limit", async () => {
    const sm = createMockSessionManager([makeSession()]); // 1 running
    const queue = createSpawnQueue({ maxConcurrentAgents: 3, sessionManager: sm });

    const session = await queue.enqueue({ projectId: "proj" } as SessionSpawnConfig);

    expect(session.id).toBe("new-agent");
    expect(sm.spawn).toHaveBeenCalled();
  });

  it("queues spawn when at WIP limit", async () => {
    const running = [
      makeSession({ id: "a1", status: "working" }),
      makeSession({ id: "a2", status: "working" }),
    ];
    const sm = createMockSessionManager(running);
    const queue = createSpawnQueue({ maxConcurrentAgents: 2, sessionManager: sm });

    // This should be queued, not spawned immediately
    const promise = queue.enqueue({ projectId: "proj" } as SessionSpawnConfig);

    const state = await queue.getState();
    expect(state.pending).toBe(1);
    expect(state.running).toBe(2);
    expect(state.limit).toBe(2);

    // Simulate agent finishing — reduce running count and process queue
    (sm.list as ReturnType<typeof vi.fn>).mockResolvedValue([makeSession({ id: "a1" })]);
    await queue.processNext();

    const session = await promise;
    expect(session.id).toBe("new-agent");
  });

  it("processes queued items when slots open", async () => {
    const running = [
      makeSession({ id: "a1", status: "working" }),
      makeSession({ id: "a2", status: "working" }),
    ];
    const sm = createMockSessionManager(running);
    const queue = createSpawnQueue({ maxConcurrentAgents: 2, sessionManager: sm });

    // Queue one item at WIP limit
    const promise = queue.enqueue({ projectId: "proj", issueId: "S-1" } as SessionSpawnConfig);

    let state = await queue.getState();
    expect(state.pending).toBe(1);

    // Simulate slot opening — reduce to 1 running
    (sm.list as ReturnType<typeof vi.fn>).mockResolvedValue([makeSession({ id: "a1" })]);
    await queue.processNext();

    const session = await promise;
    expect(session.id).toBe("new-agent");

    state = await queue.getState();
    expect(state.pending).toBe(0);
  });

  it("getState returns correct queue information", async () => {
    const sm = createMockSessionManager([makeSession()]);
    const queue = createSpawnQueue({ maxConcurrentAgents: 5, sessionManager: sm });

    const state = await queue.getState();

    expect(state.running).toBe(1);
    expect(state.pending).toBe(0);
    expect(state.limit).toBe(5);
    expect(state.entries).toEqual([]);
  });

  it("stop rejects all pending entries", async () => {
    const running = [makeSession(), makeSession()];
    const sm = createMockSessionManager(running);
    const queue = createSpawnQueue({ maxConcurrentAgents: 2, sessionManager: sm });

    const promise = queue.enqueue({ projectId: "proj" } as SessionSpawnConfig);

    // Wait a tick for the enqueue to register in the queue
    await new Promise((r) => setTimeout(r, 10));

    const state = await queue.getState();
    expect(state.pending).toBe(1);

    queue.stop();

    await expect(promise).rejects.toThrow("Queue stopped");
  });

  it("unlimited mode (no maxConcurrentAgents) always spawns immediately", async () => {
    const running = Array.from({ length: 10 }, (_, i) =>
      makeSession({ id: `a${i}`, status: "working" }),
    );
    const sm = createMockSessionManager(running);
    const queue = createSpawnQueue({ sessionManager: sm }); // No limit

    const session = await queue.enqueue({ projectId: "proj" } as SessionSpawnConfig);

    expect(session.id).toBe("new-agent");
    expect(sm.spawn).toHaveBeenCalled();

    const state = await queue.getState();
    expect(state.limit).toBeNull();
  });

  it("higher priority spawns before lower priority (Story 43.4)", async () => {
    const running = [makeSession({ id: "a1" }), makeSession({ id: "a2" })];
    const sm = createMockSessionManager(running);
    const spawnOrder: string[] = [];
    (sm.spawn as ReturnType<typeof vi.fn>).mockImplementation(async (cfg: SessionSpawnConfig) => {
      spawnOrder.push(cfg.issueId ?? "unknown");
      return makeSession({ id: `new-${cfg.issueId}` });
    });

    const queue = createSpawnQueue({ maxConcurrentAgents: 2, sessionManager: sm });

    // Enqueue low priority first, then high
    queue.enqueue({ projectId: "p", issueId: "low", priority: 10 } as SessionSpawnConfig);
    queue.enqueue({ projectId: "p", issueId: "high", priority: 100 } as SessionSpawnConfig);

    // Wait for enqueue microtasks
    await new Promise((r) => setTimeout(r, 10));

    // Open slots — processNext chains automatically via queueMicrotask
    (sm.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await queue.processNext();
    // Wait for chained microtask
    await new Promise((r) => setTimeout(r, 10));

    // "high" should have spawned first
    expect(spawnOrder[0]).toBe("high");
    expect(spawnOrder[1]).toBe("low");
  });

  it("equal priority preserves FIFO order (Story 43.4)", async () => {
    const running = [makeSession({ id: "a1" }), makeSession({ id: "a2" })];
    const sm = createMockSessionManager(running);
    const spawnOrder: string[] = [];
    (sm.spawn as ReturnType<typeof vi.fn>).mockImplementation(async (cfg: SessionSpawnConfig) => {
      spawnOrder.push(cfg.issueId ?? "unknown");
      return makeSession({ id: `new-${cfg.issueId}` });
    });

    const queue = createSpawnQueue({ maxConcurrentAgents: 2, sessionManager: sm });

    // Enqueue three items with same priority
    queue.enqueue({ projectId: "p", issueId: "first", priority: 50 } as SessionSpawnConfig);
    queue.enqueue({ projectId: "p", issueId: "second", priority: 50 } as SessionSpawnConfig);
    queue.enqueue({ projectId: "p", issueId: "third", priority: 50 } as SessionSpawnConfig);

    await new Promise((r) => setTimeout(r, 10));

    // Open slots — processNext chains automatically
    (sm.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await queue.processNext();
    // Wait for all chained processing
    await new Promise((r) => setTimeout(r, 50));

    expect(spawnOrder).toEqual(["first", "second", "third"]);
  });

  it("getState shows priority in entries (Story 43.4)", async () => {
    const running = [makeSession(), makeSession()];
    const sm = createMockSessionManager(running);
    const queue = createSpawnQueue({ maxConcurrentAgents: 2, sessionManager: sm });

    queue.enqueue({ projectId: "p", issueId: "s-1", priority: 10 } as SessionSpawnConfig);
    queue.enqueue({ projectId: "p", issueId: "s-2", priority: 90 } as SessionSpawnConfig);

    await new Promise((r) => setTimeout(r, 10));

    const state = await queue.getState();
    expect(state.entries).toHaveLength(2);
    // Sorted by priority — highest first
    expect(state.entries[0].storyId).toBe("s-2");
    expect(state.entries[0].priority).toBe(90);
    expect(state.entries[1].storyId).toBe("s-1");
    expect(state.entries[1].priority).toBe(10);
  });
});
