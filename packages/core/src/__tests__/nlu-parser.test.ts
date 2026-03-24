/**
 * NLU parser tests (Story 47.3).
 */
import { describe, expect, it } from "vitest";
import { parseCommand } from "../nlu-parser.js";

describe("parseCommand", () => {
  it("parses spawn with story ID", () => {
    const intents = parseCommand("spawn an agent for the auth story");

    expect(intents[0].action).toBe("spawn");
    expect(intents[0].params.storyId).toContain("auth");
    expect(intents[0].confidence).toBeGreaterThan(0.5);
  });

  it("parses spawn without target", () => {
    const intents = parseCommand("spawn an agent");

    expect(intents[0].action).toBe("spawn");
    expect(intents[0].confidence).toBeGreaterThan(0);
  });

  it("parses kill with agent ID", () => {
    const intents = parseCommand("kill agent-42");

    expect(intents[0].action).toBe("kill");
    expect(intents[0].params.agentId).toBe("agent-42");
  });

  it("parses resume with agent ID", () => {
    const intents = parseCommand("resume agent-7");

    expect(intents[0].action).toBe("resume");
    expect(intents[0].params.agentId).toBe("agent-7");
  });

  it("parses status command", () => {
    const intents = parseCommand("status");

    expect(intents[0].action).toBe("status");
  });

  it("parses show blocked stories", () => {
    const intents = parseCommand("show me blocked stories");

    const blocked = intents.find((i) => i.params.filter === "blocked");
    expect(blocked).toBeDefined();
  });

  it("parses list command", () => {
    const intents = parseCommand("list agents");

    const list = intents.find((i) => i.action === "list");
    expect(list?.params.type).toBe("agents");
  });

  it("returns fallback for unrecognized input", () => {
    const intents = parseCommand("make me a sandwich");

    expect(intents).toHaveLength(1);
    expect(intents[0].action).toBe("fallback");
    expect(intents[0].confidence).toBe(0);
    expect(intents[0].params.input).toContain("sandwich");
  });

  it("returns fallback for empty input", () => {
    const intents = parseCommand("");

    expect(intents[0].action).toBe("fallback");
    expect(intents[0].description).toContain("Empty");
  });

  it("returns multiple intents for ambiguous input", () => {
    // "show status" could match both "show" and "status"
    const intents = parseCommand("show status");

    expect(intents.length).toBeGreaterThanOrEqual(1);
  });

  it("sorts by confidence descending", () => {
    const intents = parseCommand("spawn agent for auth-story");

    for (let i = 1; i < intents.length; i++) {
      expect(intents[i].confidence).toBeLessThanOrEqual(intents[i - 1].confidence);
    }
  });

  it("deduplicates same action+params", () => {
    // "blocked" matches two rules but both produce show+blocked
    const intents = parseCommand("show blocked");

    const blockedIntents = intents.filter(
      (i) => i.action === "show" && i.params.filter === "blocked",
    );
    expect(blockedIntents).toHaveLength(1); // Deduped
  });

  it("includes human-readable description", () => {
    const intents = parseCommand("kill agent-5");

    expect(intents[0].description).toContain("Kill");
    expect(intents[0].description).toContain("agent-5");
  });

  it("handles alternative verbs", () => {
    expect(parseCommand("stop agent-1")[0].action).toBe("kill");
    expect(parseCommand("terminate agent-1")[0].action).toBe("kill");
    expect(parseCommand("start agent for story-1")[0].action).toBe("spawn");
    expect(parseCommand("restart agent-3")[0].action).toBe("resume");
  });

  it("returns fallback for 'spawn for ' with trailing space (empty storyId)", () => {
    const intents = parseCommand("spawn for ");
    // Should not produce a spawn intent with empty storyId
    const spawn = intents.find((i) => i.action === "spawn" && i.params.storyId === "");
    expect(spawn).toBeUndefined();
  });

  it("returns fallback for 'kill ' with trailing space (empty agentId)", () => {
    const intents = parseCommand("kill ");
    // Should not produce a kill intent with empty agentId
    const kill = intents.find((i) => i.action === "kill" && i.params.agentId === "");
    expect(kill).toBeUndefined();
  });

  it("returns fallback for extremely long input", () => {
    const longInput = "spawn ".padEnd(2000, "a");
    const intents = parseCommand(longInput);

    expect(intents).toHaveLength(1);
    expect(intents[0].action).toBe("fallback");
    expect(intents[0].description).toContain("too long");
  });
});
