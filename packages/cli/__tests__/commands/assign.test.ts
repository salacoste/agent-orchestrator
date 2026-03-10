import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Command } from "commander";
import { registerAssign } from "../../src/commands/assign.js";
import * as core from "@composio/ao-core";

// Mock the core module
vi.mock("@composio/ao-core", async () => {
  const actual = await vi.importActual("@composio/ao-core");
  return {
    ...actual,
    loadConfig: vi.fn(),
    getAgentRegistry: vi.fn(),
    getSessionsDir: vi.fn(),
    computeStoryContextHash: vi.fn(() => "test-hash-123"),
  };
});

// Mock node:fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock node:readline
vi.mock("node:readline", () => ({
  createInterface: vi.fn(() => ({
    question: (_query: string, cb: (answer: string) => void) => cb("y"),
    close: vi.fn(),
  })),
}));

// Mock ora spinner
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  })),
}));

import { existsSync, readFileSync } from "node:fs";

// Mock session manager factory
vi.mock("../../src/lib/create-session-manager.js", () => ({
  getSessionManager: vi.fn(),
}));

import { getSessionManager } from "../../src/lib/create-session-manager.js";

describe("assign command", () => {
  let program: Command;
  let mockRegistry: ReturnType<typeof createMockRegistry>;
  let mockSessionManager: ReturnType<typeof createMockSessionManager>;

  function createMockRegistry() {
    return {
      getByAgent: vi.fn(),
      getByStory: vi.fn(),
      findActiveByStory: vi.fn(),
      register: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(),
    };
  }

  function createMockSessionManager() {
    return {
      get: vi.fn(),
      send: vi.fn(),
    };
  }

  function setupBasicMocks(overrides: { config?: object; sprintStatus?: object | null } = {}) {
    // Default config
    const config = overrides.config ?? {
      projects: {
        test: {
          path: "/test/project",
          runtime: "tmux",
          agent: "claude-code",
          sessionPrefix: "test",
        },
      },
      configPath: "/test/config",
      defaults: {
        runtime: "tmux",
        agent: "claude-code",
      },
    };
    vi.mocked(core.loadConfig).mockReturnValue(config as ReturnType<typeof core.loadConfig>);
    vi.mocked(core.getSessionsDir).mockReturnValue("/test/sessions");
    vi.mocked(core.getAgentRegistry).mockReturnValue(mockRegistry);

    // Mock cwd to match project path
    vi.spyOn(process, "cwd").mockReturnValue("/test/project");

    // Default sprint-status.yaml content
    const sprintStatus = overrides.sprintStatus ?? {
      project: "test-project",
      project_key: "TEST",
      tracking_system: "bmad",
      story_location: "_bmad-output/implementation-artifacts",
      development_status: {
        "1-5-cli-manual-story-assignment": "in-progress",
        "1-1-other-story": "done",
      },
      dependencies: {},
    };

    if (sprintStatus === null) {
      // Don't create sprint-status.yaml
      vi.mocked(existsSync).mockReturnValue(false);
    } else {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (typeof path === "string" && path.includes("sprint-status.yaml")) {
          // Return YAML content
          return [
            "project: test-project",
            "project_key: TEST",
            "tracking_system: bmad",
            "story_location: _bmad-output/implementation-artifacts",
            "development_status:",
            "  1-5-cli-manual-story-assignment: in-progress",
            "  1-1-other-story: done",
            "dependencies: {}",
          ].join("\n");
        }
        if (typeof path === "string" && path.endsWith(".md")) {
          // Return story file content
          return [
            "# Story 1-5: CLI Manual Story Assignment",
            "Status: in-progress",
            "",
            "## Story",
            "As a developer, I want to manually assign stories.",
            "",
            "## Acceptance Criteria",
            "- AC1: Assign story to agent",
          ].join("\n");
        }
        return "";
      });
    }

    // Default session manager behavior
    mockSessionManager.get.mockResolvedValue({
      id: "test-agent-1",
      runtimeHandle: { id: "test-agent-1", runtimeName: "tmux", data: {} },
    });
    mockSessionManager.send.mockResolvedValue(undefined);

    // Default registry behavior - no existing assignments
    mockRegistry.getByAgent.mockReturnValue(null);
    mockRegistry.findActiveByStory.mockReturnValue(null);
  }

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();

    mockRegistry = createMockRegistry();
    mockSessionManager = createMockSessionManager();

    vi.mocked(getSessionManager).mockResolvedValue(mockSessionManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("command registration", () => {
    beforeEach(() => {
      registerAssign(program);
    });

    it("registers assign command", () => {
      const command = program.commands.find((c) => c.name() === "assign");
      expect(command).toBeTruthy();
    });

    it("requires story-id and agent-id arguments", () => {
      const command = program.commands.find((c) => c.name() === "assign");
      expect(command?._args.length).toBe(2);
    });

    it("has --force option", () => {
      const command = program.commands.find((c) => c.name() === "assign");
      const forceOption = command?.options.find((o) => o.long === "--force");
      expect(forceOption).toBeTruthy();
    });

    it("has --unassign option", () => {
      const command = program.commands.find((c) => c.name() === "assign");
      const unassignOption = command?.options.find((o) => o.long === "--unassign");
      expect(unassignOption).toBeTruthy();
    });

    it("has correct description", () => {
      const command = program.commands.find((c) => c.name() === "assign");
      expect(command?.description()).toBe("Manually assign a story to an agent");
    });
  });

  describe("assignment functionality", () => {
    beforeEach(() => {
      registerAssign(program);
    });

    it("AC1: assigns idle agent to story with context delivery", async () => {
      setupBasicMocks();

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        if (code !== 0) throw new Error(`process.exit(${code})`);
        return undefined as never;
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");
      await command?.parseAsync([
        "node",
        "test",
        "1-5-cli-manual-story-assignment",
        "test-agent-1",
        "--force",
      ]);

      // Verify registry.register was called
      expect(mockRegistry.register).toHaveBeenCalledWith({
        agentId: "test-agent-1",
        storyId: "1-5-cli-manual-story-assignment",
        assignedAt: expect.any(Date),
        status: "active",
        contextHash: "test-hash-123",
      });

      // Verify send was called to deliver context
      expect(mockSessionManager.send).toHaveBeenCalledWith(
        "test-agent-1",
        expect.stringContaining("# Story:"),
      );

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("AC2: prompts for confirmation when reassigning busy agent", async () => {
      setupBasicMocks();

      // Agent has existing assignment
      mockRegistry.getByAgent.mockReturnValue({
        agentId: "test-agent-1",
        storyId: "1-1-other-story",
        assignedAt: new Date(),
        status: "active",
        contextHash: "abc123",
      });

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        if (code !== 0) throw new Error(`process.exit(${code})`);
        return undefined as never;
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");
      await command?.parseAsync([
        "node",
        "test",
        "1-5-cli-manual-story-assignment",
        "test-agent-1",
      ]);

      // Should still register after prompt (mocked to return 'y')
      expect(mockRegistry.register).toHaveBeenCalled();

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("AC3: errors when agent not found", async () => {
      setupBasicMocks();

      // Agent session doesn't exist
      mockSessionManager.get.mockResolvedValue(null);

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");

      await expect(
        command?.parseAsync([
          "node",
          "test",
          "1-5-cli-manual-story-assignment",
          "nonexistent-agent",
        ]),
      ).rejects.toThrow("process.exit(1)");

      // Verify error was logged
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("AC4: warns and prompts when story already assigned to different agent", async () => {
      setupBasicMocks();

      // Story already assigned to another agent
      mockRegistry.findActiveByStory.mockReturnValue({
        agentId: "other-agent",
        storyId: "1-5-cli-manual-story-assignment",
        assignedAt: new Date(),
        status: "active",
        contextHash: "xyz789",
      });

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        if (code !== 0) throw new Error(`process.exit(${code})`);
        return undefined as never;
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");
      await command?.parseAsync([
        "node",
        "test",
        "1-5-cli-manual-story-assignment",
        "test-agent-1",
      ]);

      // Should proceed after prompt (mocked to return 'y')
      expect(mockRegistry.register).toHaveBeenCalled();

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("AC5: unassigns agent with --unassign flag", async () => {
      setupBasicMocks();

      mockRegistry.getByAgent.mockReturnValue({
        agentId: "test-agent-1",
        storyId: "1-5-cli-manual-story-assignment",
        assignedAt: new Date(),
        status: "active",
        contextHash: "abc123",
      });

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        if (code !== 0) throw new Error(`process.exit(${code})`);
        return undefined as never;
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");
      await command?.parseAsync([
        "node",
        "test",
        "1-5-cli-manual-story-assignment", // Must use valid story ID that exists in sprint-status.yaml
        "test-agent-1",
        "--unassign",
        "--force",
      ]);

      // Verify remove was called
      expect(mockRegistry.remove).toHaveBeenCalledWith("test-agent-1");

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("AC6: validates dependencies and warns if incomplete", async () => {
      setupBasicMocks({
        config: {
          projects: {
            test: {
              path: "/test/project",
              runtime: "tmux",
              agent: "claude-code",
              sessionPrefix: "test",
            },
          },
          configPath: "/test/config",
          defaults: {
            runtime: "tmux",
            agent: "claude-code",
          },
        },
      });

      // Update sprint status to have incomplete dependencies
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (typeof path === "string" && path.includes("sprint-status.yaml")) {
          return [
            "project: test-project",
            "project_key: TEST",
            "tracking_system: bmad",
            "story_location: _bmad-output/implementation-artifacts",
            "development_status:",
            "  1-5-cli-manual-story-assignment: in-progress",
            "  1-1-dep-story: backlog",
            "dependencies:",
            "  1-5-cli-manual-story-assignment:",
            "    - 1-1-dep-story",
          ].join("\n");
        }
        if (typeof path === "string" && path.endsWith(".md")) {
          return [
            "# Story 1-5: CLI Manual Story Assignment",
            "Status: in-progress",
            "",
            "## Story",
            "As a developer, I want to manually assign stories.",
            "",
            "## Acceptance Criteria",
            "- AC1: Assign story to agent",
          ].join("\n");
        }
        return "";
      });

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        if (code !== 0) throw new Error(`process.exit(${code})`);
        return undefined as never;
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");
      await command?.parseAsync([
        "node",
        "test",
        "1-5-cli-manual-story-assignment",
        "test-agent-1",
      ]);

      // Should proceed after prompt (mocked to return 'y')
      expect(mockRegistry.register).toHaveBeenCalled();

      exitSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      registerAssign(program);
    });

    it("handles missing config", async () => {
      vi.mocked(core.loadConfig).mockReturnValue(null);

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");

      await expect(command?.parseAsync(["node", "test", "1-5", "test-agent-1"])).rejects.toThrow(
        "process.exit(1)",
      );

      // Verify config error was logged
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No agent-orchestrator.yaml found"),
      );

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("handles missing sprint-status.yaml", async () => {
      vi.mocked(core.loadConfig).mockReturnValue({
        projects: {
          test: {
            path: "/test/project",
            runtime: "tmux",
            agent: "claude-code",
            sessionPrefix: "test",
          },
        },
        configPath: "/test/config",
        defaults: {
          runtime: "tmux",
          agent: "claude-code",
        },
      } as ReturnType<typeof core.loadConfig>);

      vi.spyOn(process, "cwd").mockReturnValue("/test/project");
      vi.mocked(existsSync).mockReturnValue(false); // No sprint-status.yaml

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");

      await expect(command?.parseAsync(["node", "test", "1-5", "test-agent-1"])).rejects.toThrow(
        "process.exit(1)",
      );

      // Verify error was logged
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No sprint-status.yaml found"));

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("handles story not found in sprint-status", async () => {
      vi.mocked(core.loadConfig).mockReturnValue({
        projects: {
          test: {
            path: "/test/project",
            runtime: "tmux",
            agent: "claude-code",
            sessionPrefix: "test",
          },
        },
        configPath: "/test/config",
        defaults: {
          runtime: "tmux",
          agent: "claude-code",
        },
      } as ReturnType<typeof core.loadConfig>);

      vi.spyOn(process, "cwd").mockReturnValue("/test/project");
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path: string) => {
        if (typeof path === "string" && path.includes("sprint-status.yaml")) {
          return [
            "project: test-project",
            "project_key: TEST",
            "tracking_system: bmad",
            "story_location: _bmad-output/implementation-artifacts",
            "development_status:",
            "  1-1-other-story: done",
          ].join("\n");
        }
        return "";
      });

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");

      await expect(
        command?.parseAsync(["node", "test", "nonexistent-story", "test-agent-1"]),
      ).rejects.toThrow("process.exit(1)");

      // Verify error was logged
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found in sprint-status.yaml"),
      );

      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("handles runtime sendMessage failure gracefully", async () => {
      setupBasicMocks();

      mockSessionManager.send.mockRejectedValue(new Error("Failed to send"));

      const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
        if (code !== 0) throw new Error(`process.exit(${code})`);
        return undefined as never;
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const command = program.commands.find((c) => c.name() === "assign");
      await command?.parseAsync([
        "node",
        "test",
        "1-5-cli-manual-story-assignment",
        "test-agent-1",
        "--force",
      ]);

      // Verify warning was logged about send failure
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("story delivery failed"));

      // Registry should still have been updated
      expect(mockRegistry.register).toHaveBeenCalled();

      exitSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
