import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { readTimeline } from "../timeline.js";
import type { ReplayEvent } from "../types.js";

let tempDir: string;

const VALID_EVENTS: ReplayEvent[] = [
  {
    t: 1.0,
    agent: "planner",
    agent_type: "planner",
    event: "agent_start",
    model: "claude-sonnet-4-6",
  },
  { t: 5.0, agent: "planner", agent_type: "planner", event: "tool_start", tool: "Read" },
  {
    t: 6.0,
    agent: "planner",
    agent_type: "planner",
    event: "tool_end",
    tool: "Read",
    duration_ms: 1000,
    success: true,
  },
  { t: 8.0, agent: "planner", agent_type: "planner", event: "file_touch", file: "src/types.ts" },
  { t: 30.0, agent: "planner", agent_type: "planner", event: "agent_stop", duration_ms: 29000 },
];

describe("readTimeline", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "timeline-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // AC11.1 — Returns parsed entries for valid JSONL file
  it("returns parsed entries for valid JSONL file", async () => {
    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-session-1.jsonl");
    const lines = VALID_EVENTS.map((e) => JSON.stringify(e)).join("\n");
    await writeFile(jsonlPath, lines);

    const entries = await readTimeline(tempDir, "session-1");

    expect(entries).toHaveLength(5);
    expect(entries[0]).toMatchObject({
      agent: "planner",
      agentType: "planner",
      event: "agent_start",
      timestamp: 1.0,
      model: "claude-sonnet-4-6",
    });
    expect(entries[0].action).toBe("Agent planner started");
  });

  // AC11.2 — Returns empty array for missing file
  it("returns empty array for missing file", async () => {
    const entries = await readTimeline(tempDir, "nonexistent-session");
    expect(entries).toEqual([]);
  });

  // AC11.3 — Skips malformed JSONL lines
  it("skips malformed JSONL lines", async () => {
    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-session-1.jsonl");

    const validEvent = JSON.stringify(VALID_EVENTS[0]);
    const lines = `${validEvent}\nnot-json\n{"broken":\n${validEvent}`;
    await writeFile(jsonlPath, lines);

    const entries = await readTimeline(tempDir, "session-1");
    expect(entries).toHaveLength(2);
  });

  // AC11.4 — Action description mapping for all ReplayEventType values
  it("maps all ReplayEventType values to human-readable actions", async () => {
    const events: ReplayEvent[] = [
      { t: 1, agent: "planner", agent_type: "planner", event: "agent_start" },
      { t: 2, agent: "executor", agent_type: "executor", event: "agent_stop" },
      { t: 3, agent: "tracer", agent_type: "tracer", event: "tool_start", tool: "Read" },
      { t: 4, agent: "tracer", agent_type: "tracer", event: "tool_end", tool: "Write" },
      { t: 5, agent: "verifier", agent_type: "verifier", event: "file_touch", file: "src/main.ts" },
      { t: 6, agent: "system", agent_type: "system", event: "intervention" },
      { t: 7, agent: "system", agent_type: "system", event: "error" },
      { t: 8, agent: "system", agent_type: "system", event: "hook_fire", tool: "pre-commit" },
      { t: 9, agent: "system", agent_type: "system", event: "hook_result", tool: "pre-commit" },
      { t: 10, agent: "system", agent_type: "system", event: "keyword_detected" },
      { t: 11, agent: "system", agent_type: "system", event: "skill_activated", tool: "search" },
      { t: 12, agent: "system", agent_type: "system", event: "skill_invoked", tool: "refactor" },
      { t: 13, agent: "system", agent_type: "system", event: "mode_change" },
    ];

    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-test.jsonl");
    await writeFile(jsonlPath, events.map((e) => JSON.stringify(e)).join("\n"));

    const entries = await readTimeline(tempDir, "test");

    expect(entries[0].action).toBe("Agent planner started");
    expect(entries[1].action).toBe("Agent executor stopped");
    expect(entries[2].action).toBe("Called Read");
    expect(entries[3].action).toBe("Finished Write");
    expect(entries[4].action).toBe("Modified src/main.ts");
    expect(entries[5].action).toBe("Human intervention");
    expect(entries[6].action).toBe("Error occurred");
    expect(entries[7].action).toBe("Hook pre-commit fired");
    expect(entries[8].action).toBe("Hook pre-commit completed");
    expect(entries[9].action).toBe("Keyword detected");
    expect(entries[10].action).toBe("Skill search activated");
    expect(entries[11].action).toBe("Skill refactor invoked");
    expect(entries[12].action).toBe("Mode changed");
  });

  // AC11.5 — Sorts entries by timestamp ascending
  it("sorts entries by timestamp ascending", async () => {
    const events: ReplayEvent[] = [
      { t: 30, agent: "a", agent_type: "a", event: "agent_stop" },
      { t: 5, agent: "b", agent_type: "b", event: "tool_start", tool: "Read" },
      { t: 1, agent: "a", agent_type: "a", event: "agent_start" },
    ];

    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-sort.jsonl");
    await writeFile(jsonlPath, events.map((e) => JSON.stringify(e)).join("\n"));

    const entries = await readTimeline(tempDir, "sort");

    expect(entries[0].timestamp).toBe(1);
    expect(entries[1].timestamp).toBe(5);
    expect(entries[2].timestamp).toBe(30);
  });

  // AC11.6 — Handles IO errors gracefully
  it("handles IO errors gracefully", async () => {
    // Create .omc/state as a file instead of directory to cause error
    await mkdir(join(tempDir, ".omc"), { recursive: true });
    await writeFile(join(tempDir, ".omc/state"), "not a directory");

    const entries = await readTimeline(tempDir, "any");
    expect(entries).toEqual([]);
  });

  // Verifies all fields are mapped correctly
  it("maps all ReplayEvent fields to TimelineEntry", async () => {
    const event: ReplayEvent = {
      t: 42.5,
      agent: "executor",
      agent_type: "executor",
      event: "tool_end",
      tool: "Write",
      file: "src/output.ts",
      duration_ms: 2500,
      success: true,
      model: "claude-haiku-4-5",
    };

    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-fields.jsonl");
    await writeFile(jsonlPath, JSON.stringify(event));

    const entries = await readTimeline(tempDir, "fields");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      agent: "executor",
      agentType: "executor",
      action: "Finished Write",
      event: "tool_end",
      timestamp: 42.5,
      duration: 2500,
      tool: "Write",
      file: "src/output.ts",
      success: true,
      model: "claude-haiku-4-5",
    });
  });

  // Handles empty file
  it("handles empty JSONL file", async () => {
    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-empty.jsonl");
    await writeFile(jsonlPath, "");

    const entries = await readTimeline(tempDir, "empty");
    expect(entries).toEqual([]);
  });

  // Handles file with only whitespace lines
  it("handles file with only whitespace lines", async () => {
    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-ws.jsonl");
    await writeFile(jsonlPath, "\n\n  \n\n");

    const entries = await readTimeline(tempDir, "ws");
    expect(entries).toEqual([]);
  });

  // Skips valid JSON that lacks required ReplayEvent fields
  it("skips valid JSON objects missing required fields", async () => {
    const stateDir = join(tempDir, ".omc/state");
    await mkdir(stateDir, { recursive: true });
    const jsonlPath = join(stateDir, "agent-replay-invalid.jsonl");

    const validEvent = JSON.stringify(VALID_EVENTS[0]);
    const lines = [
      validEvent,
      '{"foo":"bar"}', // missing event + t
      '{"event":"agent_start"}', // missing t
      '{"t":1,"event":"bogus"}', // invalid event type
      validEvent,
    ].join("\n");
    await writeFile(jsonlPath, lines);

    const entries = await readTimeline(tempDir, "invalid");
    expect(entries).toHaveLength(2);
    expect(entries[0].event).toBe("agent_start");
    expect(entries[1].event).toBe("agent_start");
  });
});
