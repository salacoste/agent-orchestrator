/**
 * Checkpoint tracker tests (Story 20.2).
 */
import { describe, expect, it } from "vitest";

import {
  addCheckpoint,
  createTimeline,
  findRollbackTarget,
  getCheckpointCount,
  type Checkpoint,
} from "../checkpoint-tracker";

function makeCheckpoint(sha: string, timestamp: string, files: number = 1): Checkpoint {
  return { sha, timestamp, filesChanged: files, message: `[checkpoint] WIP ${sha}` };
}

describe("createTimeline", () => {
  it("creates empty timeline with defaults", () => {
    const tl = createTimeline("agent-1");
    expect(tl.agentId).toBe("agent-1");
    expect(tl.checkpoints).toHaveLength(0);
    expect(tl.enabled).toBe(true);
    expect(tl.intervalMinutes).toBe(10);
  });

  it("accepts custom interval", () => {
    const tl = createTimeline("agent-1", 5);
    expect(tl.intervalMinutes).toBe(5);
  });
});

describe("addCheckpoint", () => {
  it("adds checkpoint to timeline immutably", () => {
    const tl = createTimeline("agent-1");
    const cp = makeCheckpoint("abc1234", "2026-03-21T01:00:00Z");
    const updated = addCheckpoint(tl, cp);

    expect(updated.checkpoints).toHaveLength(1);
    expect(updated.checkpoints[0].sha).toBe("abc1234");
    // Original unchanged
    expect(tl.checkpoints).toHaveLength(0);
  });

  it("maintains order (oldest first)", () => {
    let tl = createTimeline("agent-1");
    tl = addCheckpoint(tl, makeCheckpoint("aaa", "2026-03-21T01:00:00Z"));
    tl = addCheckpoint(tl, makeCheckpoint("bbb", "2026-03-21T01:10:00Z"));
    tl = addCheckpoint(tl, makeCheckpoint("ccc", "2026-03-21T01:20:00Z"));

    expect(tl.checkpoints.map((c) => c.sha)).toEqual(["aaa", "bbb", "ccc"]);
  });
});

describe("findRollbackTarget", () => {
  it("returns most recent checkpoint", () => {
    let tl = createTimeline("agent-1");
    tl = addCheckpoint(tl, makeCheckpoint("aaa", "2026-03-21T01:00:00Z"));
    tl = addCheckpoint(tl, makeCheckpoint("bbb", "2026-03-21T01:10:00Z"));

    const target = findRollbackTarget(tl, "2026-03-21T01:15:00Z");
    expect(target?.sha).toBe("bbb");
  });

  it("returns earlier checkpoint when specified before", () => {
    let tl = createTimeline("agent-1");
    tl = addCheckpoint(tl, makeCheckpoint("aaa", "2026-03-21T01:00:00Z"));
    tl = addCheckpoint(tl, makeCheckpoint("bbb", "2026-03-21T01:10:00Z"));

    const target = findRollbackTarget(tl, "2026-03-21T01:05:00Z");
    expect(target?.sha).toBe("aaa");
  });

  it("returns null for empty timeline", () => {
    const tl = createTimeline("agent-1");
    expect(findRollbackTarget(tl)).toBeNull();
  });
});

describe("getCheckpointCount", () => {
  it("returns correct count", () => {
    let tl = createTimeline("agent-1");
    expect(getCheckpointCount(tl)).toBe(0);

    tl = addCheckpoint(tl, makeCheckpoint("aaa", "2026-03-21T01:00:00Z"));
    expect(getCheckpointCount(tl)).toBe(1);
  });
});
