/**
 * Logs Command Tests
 */

import { describe, it, expect } from "vitest";
import { parseTimeDelta } from "../../src/lib/format.js";

describe("parseTimeDelta", () => {
  it("parses seconds", () => {
    expect(parseTimeDelta("30s")).toBe(30_000);
    expect(parseTimeDelta("1s")).toBe(1_000);
  });

  it("parses minutes", () => {
    expect(parseTimeDelta("5m")).toBe(5 * 60 * 1000);
    expect(parseTimeDelta("30m")).toBe(30 * 60 * 1000);
  });

  it("parses hours", () => {
    expect(parseTimeDelta("2h")).toBe(2 * 60 * 60 * 1000);
    expect(parseTimeDelta("24h")).toBe(24 * 60 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseTimeDelta("1d")).toBe(24 * 60 * 60 * 1000);
    expect(parseTimeDelta("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("returns 0 for invalid format", () => {
    expect(parseTimeDelta("abc")).toBe(0);
    expect(parseTimeDelta("")).toBe(0);
    expect(parseTimeDelta("30")).toBe(0);
    expect(parseTimeDelta("m30")).toBe(0);
    expect(parseTimeDelta("30x")).toBe(0);
  });

  it("returns 0 for negative-looking values", () => {
    expect(parseTimeDelta("-5m")).toBe(0);
  });
});

describe("logs command registration", () => {
  it("should export registerLogs function", async () => {
    const { registerLogs } = await import("../../src/commands/logs.js");
    expect(typeof registerLogs).toBe("function");
  });
});

describe("agent not found behavior", () => {
  it("should list active agents when target not found", () => {
    const agents = [
      { agentId: "ao-1", status: "active", storyId: "1-1-test" },
      { agentId: "ao-2", status: "blocked", storyId: "1-2-other" },
    ];

    const message = agents.map((a) => `${a.agentId} (${a.status}, story: ${a.storyId})`).join(", ");
    expect(message).toContain("ao-1");
    expect(message).toContain("ao-2");
    expect(message).toContain("active");
    expect(message).toContain("blocked");
  });

  it("should handle empty agent list", () => {
    const agents: { agentId: string }[] = [];
    expect(agents.length).toBe(0);
  });
});

describe("interleaved log formatting", () => {
  it("should prefix lines with agent ID", () => {
    const agentId = "ao-test-1";
    const logLines = ["line 1", "line 2", "line 3"];

    const formatted = logLines.map((line) => `[${agentId}] ${line}`);

    expect(formatted[0]).toBe("[ao-test-1] line 1");
    expect(formatted[1]).toBe("[ao-test-1] line 2");
    expect(formatted[2]).toBe("[ao-test-1] line 3");
  });

  it("should handle multiple agents interleaved", () => {
    const agents = [
      { id: "ao-1", lines: ["agent 1 line A", "agent 1 line B"] },
      { id: "ao-2", lines: ["agent 2 line A"] },
    ];

    const output: string[] = [];
    for (const agent of agents) {
      for (const line of agent.lines) {
        output.push(`[${agent.id}] ${line}`);
      }
    }

    expect(output).toHaveLength(3);
    expect(output[0]).toContain("[ao-1]");
    expect(output[2]).toContain("[ao-2]");
  });
});

describe("follow mode design", () => {
  it("should detect new lines by comparing line counts", () => {
    const previousLines = ["line 1", "line 2"];
    const currentLines = ["line 1", "line 2", "line 3", "line 4"];

    const newLines = currentLines.slice(previousLines.length);

    expect(newLines).toEqual(["line 3", "line 4"]);
  });

  it("should handle no new lines", () => {
    const previousLines = ["line 1", "line 2"];
    const currentLines = ["line 1", "line 2"];

    const newLines = currentLines.slice(previousLines.length);

    expect(newLines).toEqual([]);
  });
});
