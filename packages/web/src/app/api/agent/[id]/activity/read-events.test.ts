/**
 * Unit tests for readAgentEvents (Story 38.2).
 *
 * Tests the event reading and formatting logic using a real temp file
 * to avoid node:fs mock issues.
 */
import { describe, expect, it, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readAgentEvents } from "./read-events";

// Create a temp directory for test fixtures
const testDir = join(tmpdir(), `ao-read-events-test-${Date.now()}`);
mkdirSync(testDir, { recursive: true });

// The readAgentEvents function looks for events.jsonl at join(configPath, "..", "events.jsonl")
// So configPath should be a file inside testDir
const configPath = join(testDir, "agent-orchestrator.yaml");
writeFileSync(configPath, "# test config", "utf-8");

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function writeEvents(
  events: Array<{
    eventType: string;
    agentId?: string;
    storyId?: string;
    reason?: string;
    previousAgentId?: string;
    newAgentId?: string;
  }>,
): void {
  const lines = events.map((e, i) =>
    JSON.stringify({
      eventId: `e${i}`,
      eventType: e.eventType,
      timestamp: `2026-03-22T${String(i).padStart(2, "0")}:00:00Z`,
      metadata: {
        storyId: e.storyId ?? "S-1",
        agentId: e.agentId,
        reason: e.reason,
        previousAgentId: e.previousAgentId,
        newAgentId: e.newAgentId,
      },
    }),
  );
  writeFileSync(join(testDir, "events.jsonl"), lines.join("\n"), "utf-8");
}

describe("readAgentEvents", () => {
  it("returns empty array when events.jsonl does not exist", async () => {
    const emptyDir = join(tmpdir(), `ao-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });
    const fakePath = join(emptyDir, "config.yaml");
    writeFileSync(fakePath, "# test", "utf-8");

    const result = await readAgentEvents("agent-1", fakePath, 100);
    expect(result).toEqual([]);

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("filters events by agent ID", async () => {
    writeEvents([
      { eventType: "story.started", agentId: "agent-1" },
      { eventType: "story.completed", agentId: "other-agent" },
    ]);

    const result = await readAgentEvents("agent-1", configPath, 100);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("story.started");
    expect(result[0].description).toBe("Started working on story S-1");
  });

  it("sorts events newest first", async () => {
    writeEvents([
      { eventType: "story.started", agentId: "agent-1" },
      { eventType: "story.blocked", agentId: "agent-1", reason: "CI" },
    ]);

    const result = await readAgentEvents("agent-1", configPath, 100);

    // Index 1 has later timestamp (01:00:00Z) than index 0 (00:00:00Z)
    expect(result[0].type).toBe("story.blocked"); // 01:00:00Z — newest
    expect(result[1].type).toBe("story.started"); // 00:00:00Z
  });

  it("respects limit", async () => {
    writeEvents(
      Array.from({ length: 10 }, (_, i) => ({
        eventType: "story.started",
        agentId: "agent-1",
        storyId: `S-${i}`,
      })),
    );

    const result = await readAgentEvents("agent-1", configPath, 3);
    expect(result).toHaveLength(3);
  });

  it("matches by previousAgentId and newAgentId", async () => {
    writeEvents([
      { eventType: "agent.resumed", previousAgentId: "agent-1", newAgentId: "agent-2" },
    ]);

    const result = await readAgentEvents("agent-1", configPath, 100);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("agent.resumed");
  });

  it("formats event descriptions correctly", async () => {
    writeEvents([
      { eventType: "story.completed", agentId: "agent-1" },
      { eventType: "story.blocked", agentId: "agent-1", reason: "CI failed" },
      { eventType: "story.assigned", agentId: "agent-1" },
      { eventType: "story.unblocked", agentId: "agent-1" },
      { eventType: "custom.event", agentId: "agent-1" },
    ]);

    const result = await readAgentEvents("agent-1", configPath, 100);

    expect(result).toHaveLength(5);
    const descMap = new Map(result.map((e) => [e.type, e.description]));
    expect(descMap.get("story.completed")).toBe("Completed story S-1");
    expect(descMap.get("story.blocked")).toBe("Blocked on story S-1: CI failed");
    expect(descMap.get("story.assigned")).toBe("Assigned to story S-1");
    expect(descMap.get("story.unblocked")).toBe("Story S-1 unblocked");
    expect(descMap.get("custom.event")).toBe("custom.event for story S-1");
  });

  it("skips malformed JSON lines", async () => {
    const content = [
      "not valid json",
      JSON.stringify({
        eventId: "e1",
        eventType: "story.started",
        timestamp: "2026-03-22T01:00:00Z",
        metadata: { storyId: "S-1", agentId: "agent-1" },
      }),
    ].join("\n");
    writeFileSync(join(testDir, "events.jsonl"), content, "utf-8");

    const result = await readAgentEvents("agent-1", configPath, 100);
    expect(result).toHaveLength(1);
  });
});
