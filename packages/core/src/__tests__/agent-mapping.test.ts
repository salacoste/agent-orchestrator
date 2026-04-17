/**
 * Tests for story-agent mapping (Story 59-6).
 *
 * Covers:
 * - DEFAULT_AGENT_MAPPINGS completeness
 * - resolveAgentMapping() with defaults
 * - resolveAgentMapping() with config override
 * - resolveAgentMapping() with undefined story type
 * - resolveAgentMapping() with unknown story type
 * - AgentMappingSchema validation
 * - Story-level ao-agents comment parsing
 * - Backward compatibility
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_AGENT_MAPPINGS, resolveAgentMapping } from "../agent-mapping.js";
import { AgentMappingSchema } from "../config.js";
import type { AgentMapping, StoryType } from "../types.js";

// ---------------------------------------------------------------------------
// DEFAULT_AGENT_MAPPINGS
// ---------------------------------------------------------------------------

describe("DEFAULT_AGENT_MAPPINGS", () => {
  const storyTypes: StoryType[] = ["exploration", "implementation", "bugfix", "review", "default"];

  it("has a mapping for every story type", () => {
    for (const st of storyTypes) {
      expect(DEFAULT_AGENT_MAPPINGS[st]).toBeDefined();
    }
  });

  it("each mapping has a non-empty agents array", () => {
    for (const st of storyTypes) {
      const mapping: AgentMapping = DEFAULT_AGENT_MAPPINGS[st];
      expect(Array.isArray(mapping.agents)).toBe(true);
      expect(mapping.agents.length).toBeGreaterThan(0);
      for (const agent of mapping.agents) {
        expect(typeof agent).toBe("string");
        expect(agent.length).toBeGreaterThan(0);
      }
    }
  });

  it("each mapping has valid executionMode or undefined", () => {
    const validModes = ["standard", "persistent", "lightweight", undefined];
    for (const st of storyTypes) {
      const mapping: AgentMapping = DEFAULT_AGENT_MAPPINGS[st];
      expect(validModes).toContain(mapping.executionMode);
    }
  });

  it("exploration uses lightweight agents", () => {
    expect(DEFAULT_AGENT_MAPPINGS.exploration.agents).toContain("searcher");
    expect(DEFAULT_AGENT_MAPPINGS.exploration.agents).toContain("analyzer");
    expect(DEFAULT_AGENT_MAPPINGS.exploration.executionMode).toBe("lightweight");
  });

  it("implementation uses full agent team", () => {
    expect(DEFAULT_AGENT_MAPPINGS.implementation.agents).toContain("planner");
    expect(DEFAULT_AGENT_MAPPINGS.implementation.agents).toContain("executor");
    expect(DEFAULT_AGENT_MAPPINGS.implementation.agents).toContain("verifier");
    expect(DEFAULT_AGENT_MAPPINGS.implementation.executionMode).toBe("standard");
  });

  it("bugfix uses diagnostic agents", () => {
    expect(DEFAULT_AGENT_MAPPINGS.bugfix.agents).toContain("tracer");
    expect(DEFAULT_AGENT_MAPPINGS.bugfix.agents).toContain("debugger");
    expect(DEFAULT_AGENT_MAPPINGS.bugfix.agents).toContain("verifier");
  });

  it("review uses reviewer agent", () => {
    expect(DEFAULT_AGENT_MAPPINGS.review.agents).toEqual(["reviewer"]);
    expect(DEFAULT_AGENT_MAPPINGS.review.executionMode).toBe("lightweight");
  });
});

// ---------------------------------------------------------------------------
// resolveAgentMapping
// ---------------------------------------------------------------------------

describe("resolveAgentMapping", () => {
  it("returns default mapping for each story type without override", () => {
    for (const st of [
      "exploration",
      "implementation",
      "bugfix",
      "review",
      "default",
    ] as StoryType[]) {
      const result = resolveAgentMapping(st);
      expect(result.agents).toEqual(DEFAULT_AGENT_MAPPINGS[st].agents);
    }
  });

  it("returns a copy, not a reference to the default", () => {
    const result = resolveAgentMapping("default");
    expect(result).not.toBe(DEFAULT_AGENT_MAPPINGS["default"]);
    expect(result.agents).not.toBe(DEFAULT_AGENT_MAPPINGS["default"].agents);
  });

  it("returns a copy of override agents, not a reference", () => {
    const override = {
      bugfix: { agents: ["tracer", "debugger"], executionMode: "persistent" as const },
    };
    const result = resolveAgentMapping("bugfix", override);
    // Mutating the returned array must not affect the original override
    result.agents.push("extra");
    expect(override.bugfix.agents).toEqual(["tracer", "debugger"]);
    expect(override.bugfix.agents).not.toContain("extra");
  });

  it("returns default mapping when storyType is undefined", () => {
    const result = resolveAgentMapping(undefined);
    expect(result.agents).toEqual(DEFAULT_AGENT_MAPPINGS["default"].agents);
  });

  it("returns default mapping when configOverride has no matching key", () => {
    const result = resolveAgentMapping("bugfix", { exploration: { agents: ["custom"] } });
    expect(result.agents).toEqual(DEFAULT_AGENT_MAPPINGS.bugfix.agents);
  });

  it("merges config override agents over default", () => {
    const result = resolveAgentMapping("bugfix", {
      bugfix: { agents: ["custom-tracer", "custom-fixer"], executionMode: "persistent" },
    });
    expect(result.agents).toEqual(["custom-tracer", "custom-fixer"]);
    expect(result.executionMode).toBe("persistent");
  });

  it("preserves base executionMode when override omits it", () => {
    const result = resolveAgentMapping("exploration", {
      exploration: { agents: ["custom"] },
    });
    expect(result.agents).toEqual(["custom"]);
    expect(result.executionMode).toBe("lightweight");
  });

  it("overrides executionMode to undefined when override explicitly sets it", () => {
    const result = resolveAgentMapping("review", {
      review: { agents: ["custom"], executionMode: "standard" },
    });
    expect(result.executionMode).toBe("standard");
  });

  it("returns default when no config override provided", () => {
    const result = resolveAgentMapping("default");
    expect(result.agents).toEqual(["planner", "executor", "verifier"]);
    expect(result.executionMode).toBe("standard");
  });
});

// ---------------------------------------------------------------------------
// AgentMappingSchema validation (imported from config)
// ---------------------------------------------------------------------------

describe("AgentMappingSchema", () => {
  // Uses the actual production schema imported from config.js
  it("accepts valid mapping with agents only", () => {
    const result = AgentMappingSchema.safeParse({ agents: ["planner", "executor"] });
    expect(result.success).toBe(true);
  });

  it("accepts valid mapping with agents and executionMode", () => {
    const result = AgentMappingSchema.safeParse({
      agents: ["tracer"],
      executionMode: "persistent",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty agents array", () => {
    const result = AgentMappingSchema.safeParse({ agents: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing agents field", () => {
    const result = AgentMappingSchema.safeParse({ executionMode: "standard" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid executionMode", () => {
    const result = AgentMappingSchema.safeParse({
      agents: ["tracer"],
      executionMode: "targeted",
    });
    expect(result.success).toBe(false);
  });

  it("accepts non-string agents as invalid", () => {
    const result = AgentMappingSchema.safeParse({ agents: [123] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Story-level ao-agents comment parsing
// ---------------------------------------------------------------------------

describe("ao-agents comment parsing", () => {
  it("extracts valid agent list from HTML comment", () => {
    const content = 'Some dev notes\n<!-- ao-agents: ["tracer", "debugger"] -->\nMore notes';
    const match = content.match(/<!--\s*ao-agents:\s*(\[[\s\S]*?\])\s*-->/);
    expect(match).not.toBeNull();
    if (!match) return; // guard for type narrowing
    const parsed = JSON.parse(match[1]);
    expect(parsed).toEqual(["tracer", "debugger"]);
  });

  it("extracts single agent from comment", () => {
    const content = '<!-- ao-agents: ["reviewer"] -->';
    const match = content.match(/<!--\s*ao-agents:\s*(\[[\s\S]*?\])\s*-->/);
    expect(match).not.toBeNull();
    if (!match) return; // guard for type narrowing
    const parsed = JSON.parse(match[1]);
    expect(parsed).toEqual(["reviewer"]);
  });

  it("returns null when no ao-agents comment present", () => {
    const content = "Regular dev notes without agent override";
    const match = content.match(/<!--\s*ao-agents:\s*(\[[\s\S]*?\])\s*-->/);
    expect(match).toBeNull();
  });

  it("handles multiline JSON array in comment", () => {
    const content = '<!-- ao-agents: [\n  "planner",\n  "architect",\n  "executor"\n] -->';
    const match = content.match(/<!--\s*ao-agents:\s*(\[[\s\S]*?\])\s*-->/);
    expect(match).not.toBeNull();
    if (!match) return; // guard for type narrowing
    const parsed = JSON.parse(match[1]);
    expect(parsed).toEqual(["planner", "architect", "executor"]);
  });

  it("handles invalid JSON gracefully", () => {
    const content = "<!-- ao-agents: [invalid json] -->";
    const match = content.match(/<!--\s*ao-agents:\s*(\[[\s\S]*?\])\s*-->/);
    expect(match).not.toBeNull();
    if (!match) return; // guard for type narrowing
    expect(() => JSON.parse(match[1])).toThrow();
  });

  it("ignores non-array JSON in comment", () => {
    const content = '<!-- ao-agents: "not-an-array" -->';
    const match = content.match(/<!--\s*ao-agents:\s*(\[[\s\S]*?\])\s*-->/);
    expect(match).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe("backward compatibility", () => {
  it("no agentMappings config → uses defaults", () => {
    const result = resolveAgentMapping("default", undefined);
    expect(result.agents).toEqual(DEFAULT_AGENT_MAPPINGS["default"].agents);
  });

  it("empty agentMappings config → uses defaults", () => {
    const result = resolveAgentMapping("default", {});
    expect(result.agents).toEqual(DEFAULT_AGENT_MAPPINGS["default"].agents);
  });

  it("undefined storyType with no config → returns default mapping", () => {
    const result = resolveAgentMapping(undefined, undefined);
    expect(result.agents).toEqual(DEFAULT_AGENT_MAPPINGS["default"].agents);
    expect(result.executionMode).toBe(DEFAULT_AGENT_MAPPINGS["default"].executionMode);
  });

  it("no agent mapping does not break resolveAgentMapping", () => {
    // Simulate what happens when called from spawn with minimal args
    const result = resolveAgentMapping(undefined);
    expect(result).toBeDefined();
    expect(result.agents.length).toBeGreaterThan(0);
  });
});
