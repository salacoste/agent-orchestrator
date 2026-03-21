import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StateManager, SetResult } from "../types.js";
import { updateSprintStatus } from "../completion-handlers.js";

// Mock node:fs
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import { readFileSync, renameSync } from "node:fs";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createMockStateManager(overrides?: Partial<StateManager>): StateManager {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockReturnValue(null),
    getAll: vi.fn().mockReturnValue(new Map()),
    set: vi.fn().mockResolvedValue({ success: true, version: "v2" }),
    update: vi.fn().mockResolvedValue({ success: true, version: "v2" }),
    batchSet: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    invalidate: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue("v1"),
    close: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockResolvedValue({ valid: true }),
    ...overrides,
  };
}

const SPRINT_YAML = `development_status:
  story-1: in-progress
  story-2: backlog
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateSprintStatus with StateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses stateManager.update() when StateManager is provided", () => {
    const sm = createMockStateManager();

    const result = updateSprintStatus("/fake/project", "story-1", "done", sm);

    expect(result).toBe(true);
    expect(sm.getVersion).toHaveBeenCalledWith("story-1");
    expect(sm.update).toHaveBeenCalledWith("story-1", { status: "done" }, "v1");
  });

  it("falls back to direct YAML write when no StateManager is provided", () => {
    vi.mocked(readFileSync).mockReturnValue(SPRINT_YAML);

    const result = updateSprintStatus("/fake/project", "story-1", "done");

    expect(result).toBe(true);
    expect(renameSync).toHaveBeenCalled();
  });

  it("retries once on version conflict", async () => {
    const conflictResult: SetResult = { success: false, version: "v1", conflict: true };
    const successResult: SetResult = { success: true, version: "v3" };

    const sm = createMockStateManager({
      update: vi.fn().mockResolvedValueOnce(conflictResult).mockResolvedValueOnce(successResult),
      getVersion: vi.fn().mockReturnValueOnce("v1").mockReturnValueOnce("v2"),
    });

    updateSprintStatus("/fake/project", "story-1", "done", sm);

    // Allow the promise chain to resolve
    await vi.waitFor(() => {
      expect(sm.update).toHaveBeenCalledTimes(2);
    });

    // Second call should use the fresh version
    expect(sm.getVersion).toHaveBeenCalledTimes(2);
  });

  it("falls back to direct YAML on StateManager error", async () => {
    const sm = createMockStateManager({
      update: vi.fn().mockRejectedValue(new Error("StateManager crashed")),
    });
    vi.mocked(readFileSync).mockReturnValue(SPRINT_YAML);

    updateSprintStatus("/fake/project", "story-1", "done", sm);

    // Allow the promise rejection + fallback to run
    await vi.waitFor(() => {
      expect(renameSync).toHaveBeenCalled();
    });
  });

  it("passes expectedVersion as undefined when getVersion returns null", () => {
    const sm = createMockStateManager({
      getVersion: vi.fn().mockReturnValue(null),
    });

    updateSprintStatus("/fake/project", "story-1", "done", sm);

    expect(sm.update).toHaveBeenCalledWith("story-1", { status: "done" }, undefined);
  });

  it("handles synchronous StateManager throw with direct YAML fallback", () => {
    const sm = createMockStateManager({
      getVersion: vi.fn().mockImplementation(() => {
        throw new Error("sync error");
      }),
    });
    vi.mocked(readFileSync).mockReturnValue(SPRINT_YAML);

    const result = updateSprintStatus("/fake/project", "story-1", "done", sm);

    // Should fall back to direct YAML write
    expect(result).toBe(true);
    expect(renameSync).toHaveBeenCalled();
  });
});
