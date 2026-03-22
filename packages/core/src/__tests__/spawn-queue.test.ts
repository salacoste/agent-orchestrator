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
});
