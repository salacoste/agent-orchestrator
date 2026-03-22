/**
 * Collaboration JSONL persistence tests (Story 39.2).
 */
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initCollaborationStore,
  stopCollaborationStore,
  flushCollaborationStore,
} from "../collaboration-store";
import {
  logDecision,
  claimItem,
  unclaimItem,
  updatePresence,
  _resetCollaboration,
  type Decision,
  type ReviewClaim,
} from "../collaboration";

const testDir = join(tmpdir(), `ao-collab-store-${randomUUID()}`);

beforeEach(() => {
  // Stop store FIRST (unsubscribes), then reset collaboration (clears state)
  stopCollaborationStore();
  _resetCollaboration();
  // Clean and recreate test dir
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  stopCollaborationStore();
  rmSync(testDir, { recursive: true, force: true });
});

describe("collaboration-store", () => {
  it("persists decisions to JSONL on logDecision()", async () => {
    await initCollaborationStore(testDir);

    logDecision({ who: "Alice", what: "Use React", why: "Team knows it" });
    logDecision({ who: "Bob", what: "Add caching", why: "Performance" });

    await flushCollaborationStore();

    const content = readFileSync(join(testDir, "decisions.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const d1 = JSON.parse(lines[0]) as Decision;
    expect(d1.who).toBe("Alice");
    expect(d1.what).toBe("Use React");
  });

  it("persists claims to JSONL on claimItem()", async () => {
    await initCollaborationStore(testDir);

    claimItem("pr-1", "user-1", "Review PR #1");

    await flushCollaborationStore();

    const content = readFileSync(join(testDir, "claims.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]) as { action: string; data: ReviewClaim };
    expect(entry.action).toBe("claim");
    expect(entry.data.itemId).toBe("pr-1");
  });

  it("persists unclaim events", async () => {
    await initCollaborationStore(testDir);

    claimItem("pr-1", "user-1", "Review PR #1");
    unclaimItem("pr-1");

    await flushCollaborationStore();

    const content = readFileSync(join(testDir, "claims.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const entry2 = JSON.parse(lines[1]) as { action: string };
    expect(entry2.action).toBe("unclaim");
  });

  it("does NOT persist presence events", async () => {
    await initCollaborationStore(testDir);

    updatePresence({
      userId: "user-1",
      displayName: "Alice",
      currentPage: "/dashboard",
      lastSeenAt: new Date().toISOString(),
    });

    await flushCollaborationStore();

    // No presence.jsonl should be created
    expect(existsSync(join(testDir, "presence.jsonl"))).toBe(false);
  });

  it("loads decisions on init with shape validation", async () => {
    // Pre-seed decisions.jsonl (includes one invalid entry)
    const lines = [
      JSON.stringify({
        id: "d-1",
        who: "Alice",
        what: "Use React",
        why: "Team",
        timestamp: "2026-03-22T00:00:00Z",
      }),
      JSON.stringify({ badField: true }), // Invalid — will be filtered
      JSON.stringify({
        id: "d-2",
        who: "Bob",
        what: "Add cache",
        why: "Speed",
        timestamp: "2026-03-22T01:00:00Z",
      }),
    ];
    writeFileSync(join(testDir, "decisions.jsonl"), lines.join("\n") + "\n", "utf-8");

    const loaded: Decision[] = [];
    await initCollaborationStore(testDir, (d) => loaded.push(...d));

    expect(loaded).toHaveLength(2);
    expect(loaded[0].who).toBe("Alice");
    expect(loaded[1].who).toBe("Bob");
  });

  it("loads claims on init and resolves latest state", async () => {
    // Pre-seed claims.jsonl: claim → unclaim pr-1, claim pr-2
    const events = [
      JSON.stringify({
        action: "claim",
        data: {
          itemId: "pr-1",
          claimedBy: "user-1",
          claimedAt: "2026-03-22T00:00:00Z",
          itemDescription: "PR 1",
        },
        timestamp: "2026-03-22T00:00:00Z",
      }),
      JSON.stringify({
        action: "unclaim",
        data: {
          itemId: "pr-1",
          claimedBy: "user-1",
          claimedAt: "2026-03-22T00:00:00Z",
          itemDescription: "PR 1",
        },
        timestamp: "2026-03-22T00:01:00Z",
      }),
      JSON.stringify({
        action: "claim",
        data: {
          itemId: "pr-2",
          claimedBy: "user-2",
          claimedAt: "2026-03-22T00:02:00Z",
          itemDescription: "PR 2",
        },
        timestamp: "2026-03-22T00:02:00Z",
      }),
    ];
    writeFileSync(join(testDir, "claims.jsonl"), events.join("\n") + "\n", "utf-8");

    const loaded: ReviewClaim[] = [];
    await initCollaborationStore(testDir, undefined, (c) => loaded.push(...c));

    // pr-1 was unclaimed, only pr-2 remains
    expect(loaded).toHaveLength(1);
    expect(loaded[0].itemId).toBe("pr-2");
  });

  it("skips malformed JSONL lines", async () => {
    const content =
      "not valid json\n" +
      JSON.stringify({
        id: "d-1",
        who: "A",
        what: "B",
        why: "C",
        timestamp: "2026-03-22T00:00:00Z",
      }) +
      "\n";
    writeFileSync(join(testDir, "decisions.jsonl"), content, "utf-8");

    const loaded: Decision[] = [];
    await initCollaborationStore(testDir, (d) => loaded.push(...d));

    expect(loaded).toHaveLength(1);
  });

  it("creates directory if it does not exist", async () => {
    const newDir = join(testDir, "subdir", "collab");
    expect(existsSync(newDir)).toBe(false);

    await initCollaborationStore(newDir);

    expect(existsSync(newDir)).toBe(true);
  });

  it("stopCollaborationStore stops persisting", async () => {
    await initCollaborationStore(testDir);

    logDecision({ who: "Alice", what: "First", why: "Test" });
    await flushCollaborationStore();

    stopCollaborationStore();

    logDecision({ who: "Bob", what: "Second", why: "Test" });
    // No flush needed — store is stopped, nothing to flush

    const content = readFileSync(join(testDir, "decisions.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    // Only the first decision should be persisted
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).who).toBe("Alice");
  });

  it("calling init twice cleans up previous subscription", async () => {
    const dir1 = join(testDir, "dir1");
    const dir2 = join(testDir, "dir2");

    await initCollaborationStore(dir1);
    await initCollaborationStore(dir2); // Should stop dir1 subscription

    logDecision({ who: "Alice", what: "Test", why: "Check" });
    await flushCollaborationStore();

    // Only dir2 should have the decision
    expect(existsSync(join(dir2, "decisions.jsonl"))).toBe(true);
    // dir1 should NOT have the decision (subscription was cleaned up)
    expect(existsSync(join(dir1, "decisions.jsonl"))).toBe(false);
  });
});
