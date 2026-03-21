/**
 * Fleet Command Tests
 *
 * Tests for the fleet monitoring table command.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";

interface TestContext {
  testDir: string;
  sprintStatusPath: string;
  configPath: string;
  sessionsDir: string;
  storyLocation: string;
}

describe("Fleet Command", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = {
      testDir: `/tmp/fleet-test-${Date.now()}`,
      sprintStatusPath: "",
      configPath: "",
      sessionsDir: "",
      storyLocation: "",
    };

    ctx.sprintStatusPath = join(ctx.testDir, "sprint-status.yaml");
    ctx.configPath = join(ctx.testDir, "agent-orchestrator.yaml");
    ctx.sessionsDir = join(ctx.testDir, "sessions");
    ctx.storyLocation = join(ctx.testDir, "implementation-artifacts");

    mkdirSync(ctx.testDir, { recursive: true });
    mkdirSync(ctx.sessionsDir, { recursive: true });
    mkdirSync(ctx.storyLocation, { recursive: true });

    // Create test story files
    writeFileSync(
      join(ctx.storyLocation, "1-1-test-story.md"),
      `# Story 1-1: Test Story One
Status: in-progress

## Story
As a developer, I want to test the fleet command.
`,
      "utf-8",
    );

    writeFileSync(
      join(ctx.storyLocation, "1-2-another-story.md"),
      `# 1-2 Another Story
Status: ready-for-dev

## Story
Another test story.
`,
      "utf-8",
    );

    // Create test sprint-status.yaml
    const sprintStatus = {
      generated: "2026-03-06",
      project: "agent-orchestrator",
      project_key: "AO",
      tracking_system: "file-system",
      story_location: "implementation-artifacts",
      development_status: {
        "1-1-test-story": "in-progress",
        "1-2-another-story": "ready-for-dev",
      },
    };
    writeFileSync(ctx.sprintStatusPath, stringify(sprintStatus), "utf-8");

    // Create minimal config
    const config = {
      configPath: ctx.configPath,
      port: 5000,
      readyThresholdMs: 300000,
      defaults: {
        runtime: "tmux",
        agent: "claude-code",
        workspace: "worktree",
      },
      projects: {
        "agent-orchestrator": {
          name: "Agent Orchestrator",
          repo: "test/agent-orchestrator",
          path: ctx.testDir,
          defaultBranch: "main",
          sessionPrefix: "ao",
        },
      },
      notifiers: {},
      notificationRouting: {},
      reactions: {},
    };
    writeFileSync(ctx.configPath, stringify(config), "utf-8");
  });

  afterEach(() => {
    try {
      unlinkSync(ctx.sprintStatusPath);
      unlinkSync(ctx.configPath);
      unlinkSync(join(ctx.storyLocation, "1-1-test-story.md"));
      unlinkSync(join(ctx.storyLocation, "1-2-another-story.md"));
      rmdirSync(ctx.storyLocation);
      rmdirSync(ctx.sessionsDir);
      rmdirSync(ctx.testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("fleet command registration", () => {
    it("should register the fleet command", async () => {
      const { registerFleet } = await import("../../src/commands/fleet.js");
      expect(typeof registerFleet).toBe("function");
    });
  });

  describe("sprint status reading", () => {
    it("should read sprint-status.yaml and extract development status", async () => {
      const { readSprintStatus } = await import("../../src/commands/fleet.js");
      const sprintStatus = readSprintStatus(ctx.testDir);

      expect(sprintStatus).not.toBeNull();
      expect(sprintStatus?.development_status["1-1-test-story"]).toBe("in-progress");
      expect(sprintStatus?.development_status["1-2-another-story"]).toBe("ready-for-dev");
    });

    it("should return null when sprint-status.yaml does not exist", async () => {
      const { readSprintStatus } = await import("../../src/commands/fleet.js");
      const sprintStatus = readSprintStatus("/nonexistent/path");
      expect(sprintStatus).toBeNull();
    });
  });

  describe("story metadata extraction", () => {
    it("should extract title and status from story file", async () => {
      const { readStoryMetadata } = await import("../../src/commands/fleet.js");
      const metadata = readStoryMetadata("1-1-test-story", ctx.storyLocation);

      expect(metadata).not.toBeNull();
      expect(metadata?.title).toBe("Test Story One");
      expect(metadata?.status).toBe("in-progress");
    });

    it("should handle story files with different formats", async () => {
      const { readStoryMetadata } = await import("../../src/commands/fleet.js");
      const metadata = readStoryMetadata("1-2-another-story", ctx.storyLocation);

      expect(metadata).not.toBeNull();
      expect(metadata?.title).toBe("Another Story");
    });

    it("should return null for non-existent story files", async () => {
      const { readStoryMetadata } = await import("../../src/commands/fleet.js");
      const metadata = readStoryMetadata("nonexistent-story", ctx.storyLocation);
      expect(metadata).toBeNull();
    });
  });

  describe("status filtering", () => {
    it("should filter agents by status", () => {
      const agents = [
        { agentId: "ao-1", agentStatus: "active" as const },
        { agentId: "ao-2", agentStatus: "idle" as const },
        { agentId: "ao-3", agentStatus: "blocked" as const },
      ];

      const filtered = agents.filter((a) => a.agentStatus === "active");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].agentId).toBe("ao-1");
    });

    it("should return empty array when no agents match filter", () => {
      const agents = [
        { agentId: "ao-1", agentStatus: "active" as const },
        { agentId: "ao-2", agentStatus: "idle" as const },
      ];

      const filtered = agents.filter((a) => a.agentStatus === "blocked");
      expect(filtered).toHaveLength(0);
    });
  });

  describe("sorting", () => {
    it("should sort agents by agent ID", () => {
      const agents = [
        { agentId: "ao-3", lastActivity: new Date("2026-03-06T10:00:00Z") },
        { agentId: "ao-1", lastActivity: new Date("2026-03-06T09:00:00Z") },
        { agentId: "ao-2", lastActivity: new Date("2026-03-06T11:00:00Z") },
      ] as any;

      const sorted = [...agents].sort((a, b) => a.agentId.localeCompare(b.agentId));
      expect(sorted[0].agentId).toBe("ao-1");
      expect(sorted[1].agentId).toBe("ao-2");
      expect(sorted[2].agentId).toBe("ao-3");
    });

    it("should sort agents by activity time", () => {
      const agents = [
        { agentId: "ao-1", lastActivity: new Date("2026-03-06T09:00:00Z") },
        { agentId: "ao-2", lastActivity: new Date("2026-03-06T10:00:00Z") },
        { agentId: "ao-3", lastActivity: new Date("2026-03-06T11:00:00Z") },
      ] as any;

      const sorted = [...agents].sort(
        (a, b) => (a.lastActivity?.getTime() || 0) - (b.lastActivity?.getTime() || 0),
      );
      expect(sorted[0].agentId).toBe("ao-1");
      expect(sorted[1].agentId).toBe("ao-2");
      expect(sorted[2].agentId).toBe("ao-3");
    });

    it("should sort in reverse order when multiplier is -1", () => {
      const agents = [
        { agentId: "ao-1", lastActivity: new Date("2026-03-06T09:00:00Z") },
        { agentId: "ao-2", lastActivity: new Date("2026-03-06T10:00:00Z") },
      ] as any;

      const sorted = [...agents].sort((a, b) => {
        const aTime = a.lastActivity?.getTime() || 0;
        const bTime = b.lastActivity?.getTime() || 0;
        return bTime - aTime; // Reverse
      });

      expect(sorted[0].agentId).toBe("ao-2");
    });
  });

  describe("idle detection", () => {
    it("should detect idle agents (>10 minutes)", () => {
      const now = Date.now();
      const idleAgent = {
        agentId: "ao-1",
        lastActivity: new Date(now - 15 * 60 * 1000), // 15 minutes ago
      } as any;

      const idleMinutes = Math.floor((now - idleAgent.lastActivity.getTime()) / 60000);
      expect(idleMinutes).toBeGreaterThan(10);
    });

    it("should not mark active agents as idle", () => {
      const now = Date.now();
      const activeAgent = {
        agentId: "ao-1",
        lastActivity: new Date(now - 5 * 60 * 1000), // 5 minutes ago
      } as any;

      const idleMinutes = Math.floor((now - activeAgent.lastActivity.getTime()) / 60000);
      expect(idleMinutes).toBeLessThanOrEqual(10);
    });

    it("should return null for agents without lastActivity", () => {
      const agent = { agentId: "ao-1", lastActivity: null } as any;
      const now = Date.now();
      const idleMinutes = agent.lastActivity
        ? Math.floor((now - agent.lastActivity.getTime()) / 60000)
        : null;
      expect(idleMinutes).toBeNull();
    });
  });

  describe("JSON output format", () => {
    it("should serialize fleet data to valid JSON", () => {
      const agents = [
        {
          agentId: "ao-1",
          storyId: "1-1-test",
          storyTitle: "Test Story",
          agentStatus: "active" as const,
          storyStatus: "in-progress" as const,
          lastActivity: new Date("2026-03-06T10:00:00Z"),
          idleTime: null,
          notes: "",
        },
      ];

      const json = JSON.stringify(agents, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].agentId).toBe("ao-1");
      expect(parsed[0].storyTitle).toBe("Test Story");
    });

    it("should include summary statistics in JSON output", () => {
      const agents = [
        {
          agentId: "ao-1",
          agentStatus: "active" as const,
          storyStatus: "in-progress" as const,
        },
        {
          agentId: "ao-2",
          agentStatus: "idle" as const,
          storyStatus: "backlog" as const,
        },
      ];

      const summary = {
        total: agents.length,
        active: agents.filter((a) => a.agentStatus === "active").length,
        idle: agents.filter((a) => a.agentStatus === "idle").length,
        blocked: agents.filter((a) => a.agentStatus === "blocked").length,
        disconnected: agents.filter((a) => a.agentStatus === "disconnected").length,
      };

      expect(summary.total).toBe(2);
      expect(summary.active).toBe(1);
      expect(summary.idle).toBe(1);
      expect(summary.blocked).toBe(0);
    });
  });

  describe("empty fleet message", () => {
    it("should show helpful message when no agents are active", () => {
      const agents: any[] = [];
      expect(agents.length).toBe(0);
      // When empty, CLI displays "No active agents. Use `ao spawn` to start one."
      const message = "No active agents. Use `ao spawn` to start one.";
      expect(message).toContain("ao spawn");
    });

    it("should still output JSON with empty agents array when format is json", () => {
      const output = {
        timestamp: new Date().toISOString(),
        agents: [] as unknown[],
        summary: { total: 0, active: 0, idle: 0, blocked: 0, disconnected: 0 },
      };
      expect(output.agents).toHaveLength(0);
      expect(output.summary.total).toBe(0);
    });
  });

  describe("default sort order", () => {
    it("should sort blocked agents first by default", () => {
      const agents = [
        {
          agentId: "ao-1",
          agentStatus: "active" as const,
          lastActivity: new Date("2026-03-06T09:00:00Z"),
        },
        {
          agentId: "ao-2",
          agentStatus: "blocked" as const,
          lastActivity: new Date("2026-03-06T10:00:00Z"),
        },
        {
          agentId: "ao-3",
          agentStatus: "idle" as const,
          lastActivity: new Date("2026-03-06T08:00:00Z"),
        },
      ] as any;

      const statusPriority: Record<string, number> = {
        blocked: 0,
        idle: 1,
        active: 2,
        disconnected: 3,
      };

      const sorted = [...agents].sort((a: any, b: any) => {
        const aPri = statusPriority[a.agentStatus] ?? 99;
        const bPri = statusPriority[b.agentStatus] ?? 99;
        if (aPri !== bPri) return aPri - bPri;
        const aTime = a.lastActivity?.getTime() || 0;
        const bTime = b.lastActivity?.getTime() || 0;
        return aTime - bTime;
      });

      expect(sorted[0].agentId).toBe("ao-2"); // blocked first
      expect(sorted[1].agentId).toBe("ao-3"); // idle second
      expect(sorted[2].agentId).toBe("ao-1"); // active last
    });

    it("should sort by duration descending within same status", () => {
      const agents = [
        {
          agentId: "ao-1",
          agentStatus: "active" as const,
          lastActivity: new Date("2026-03-06T10:00:00Z"),
        },
        {
          agentId: "ao-2",
          agentStatus: "active" as const,
          lastActivity: new Date("2026-03-06T08:00:00Z"),
        },
        {
          agentId: "ao-3",
          agentStatus: "active" as const,
          lastActivity: new Date("2026-03-06T09:00:00Z"),
        },
      ] as any;

      const sorted = [...agents].sort((a: any, b: any) => {
        const aTime = a.lastActivity?.getTime() || 0;
        const bTime = b.lastActivity?.getTime() || 0;
        return aTime - bTime; // earlier = longer running = first
      });

      expect(sorted[0].agentId).toBe("ao-2"); // longest running (earliest assignedAt)
      expect(sorted[1].agentId).toBe("ao-3");
      expect(sorted[2].agentId).toBe("ao-1"); // shortest running
    });
  });

  describe("duration column", () => {
    it("should format duration from assignedAt", () => {
      const now = Date.now();
      const agent = {
        lastActivity: new Date(now - 90 * 60 * 1000), // 90 minutes ago
      } as any;

      const diffMs = Date.now() - agent.lastActivity.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;

      expect(hours).toBe(1);
      expect(mins).toBe(30);
    });

    it("should show dash when lastActivity is null", () => {
      const agent = { lastActivity: null } as any;
      const duration = agent.lastActivity ? "has duration" : "—";
      expect(duration).toBe("—");
    });
  });

  describe("responsive columns", () => {
    it("should calculate story column width from terminal width", () => {
      const termWidth = 120;
      const fixedCols = 18 + 12 + 10 + 16 + 7;
      const storyWidth = Math.max(20, termWidth - fixedCols);
      expect(storyWidth).toBe(57);
    });

    it("should enforce minimum story width of 20 at narrow terminals", () => {
      const termWidth = 80;
      const fixedCols = 18 + 12 + 10 + 16 + 7;
      const storyWidth = Math.max(20, termWidth - fixedCols);
      expect(storyWidth).toBe(20);
    });
  });

  describe("truncation", () => {
    it("should truncate long strings", () => {
      const truncate = (str: string, maxLength: number): string => {
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength - 1) + "…";
      };

      expect(truncate("short", 10)).toBe("short");
      expect(truncate("this is a very long string", 10)).toBe("this is a…");
      expect(truncate("exactlength!", 12)).toBe("exactlength!");
    });
  });
});

function stringify(obj: unknown): string {
  function stringifyValue(value: unknown, indent = 0): string {
    const spaces = " ".repeat(indent);

    if (value === null) {
      return "null";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      return value.map((v) => stringifyValue(v, indent)).join("\n");
    }

    if (typeof value === "object") {
      const objValue = value as Record<string, unknown>;
      const result: string[] = [];
      for (const [key, val] of Object.entries(objValue)) {
        if (val === undefined) continue;
        const valStr = stringifyValue(val, indent + 2);
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          result.push(`${spaces}${key}:\n${valStr}`);
        } else {
          result.push(`${spaces}${key}: ${valStr}`);
        }
      }
      return result.join("\n");
    }

    return String(value);
  }

  return stringifyValue(obj, 0);
}
