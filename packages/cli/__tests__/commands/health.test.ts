import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { mockConfigRef, mockGetTracker, mockSessionsDir } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockGetTracker: vi.fn(),
  mockSessionsDir: { current: "" },
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
    // Mock path functions that require config file to exist
    getSessionsDir: () => mockSessionsDir.current,
    getProjectBaseDir: () => mockSessionsDir.current.replace("/sessions", ""),
    getAgentRegistry: () => new Map(),
  };
});

vi.mock("../../src/lib/plugins.js", () => ({
  getTracker: mockGetTracker,
  getAgent: vi.fn(),
  getAgentByName: vi.fn(),
  getSCM: vi.fn(),
}));

let tmpDir: string;

import { Command } from "commander";
import { registerHealth } from "../../src/commands/health.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let _consoleErrorSpy: ReturnType<typeof vi.spyOn>;

/**
 * Create a mock BMAD tracker with required methods
 */
function makeMockTracker() {
  return {
    name: "bmad",
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-health-test-"));

  // Set up mock sessions dir
  mockSessionsDir.current = join(tmpDir, "sessions");

  mockConfigRef.current = {
    configPath: join(tmpDir, "agent-orchestrator.yaml"),
    port: 5000,
    defaults: {
      runtime: "tmux",
      agent: "claude-code",
      workspace: "worktree",
      notifiers: ["desktop"],
    },
    projects: {
      "my-app": {
        name: "My App",
        repo: "org/my-app",
        path: join(tmpDir, "main-repo"),
        defaultBranch: "main",
        sessionPrefix: "app",
        tracker: { plugin: "bmad" },
      },
    },
    notifiers: {},
    notificationRouting: {},
    reactions: {},
  } as Record<string, unknown>;

  mockGetTracker.mockReturnValue(makeMockTracker());

  program = new Command();
  program.exitOverride();
  registerHealth(program);

  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  _consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    // Only throw on non-zero exit codes to allow successful tests to complete
    if (code !== 0) {
      throw new Error(`process.exit(${code})`);
    }
    return undefined as never;
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("health command", () => {
  it("displays system health output", async () => {
    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("System Health");
    expect(output).toContain("healthy");
  });

  it("displays BMAD Tracker component when tracker is bmad", async () => {
    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("BMAD Tracker");
  });

  it("displays Agent Registry component", async () => {
    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Agent Registry");
  });

  it("outputs valid JSON with --json flag", async () => {
    await program.parseAsync(["node", "test", "health", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as {
      overall: string;
      components: Array<{ component: string; status: string }>;
      exitCode: number;
    };
    expect(parsed.overall).toBe("healthy");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.components).toBeInstanceOf(Array);
  });

  it("handles non-bmad tracker (skips BMAD check)", async () => {
    mockGetTracker.mockReturnValue({ name: "github" });

    // Non-bmad tracker should NOT exit(1), just skip BMAD health check
    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    // Should show Agent Registry but not BMAD Tracker
    expect(output).toContain("Agent Registry");
    expect(output).not.toContain("BMAD Tracker");
  });

  it("resolves project when specified", async () => {
    await program.parseAsync(["node", "test", "health", "my-app"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("My App");
  });

  it("handles no tracker configured (skips BMAD check)", async () => {
    mockGetTracker.mockReturnValue(null);

    // No tracker should NOT exit(1), just skip BMAD health check
    await program.parseAsync(["node", "test", "health"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Agent Registry");
    expect(output).not.toContain("BMAD Tracker");
  });

  it("exits with code 1 when component is unhealthy", async () => {
    const unhealthyTracker = makeMockTracker();
    unhealthyTracker.isAvailable.mockResolvedValue(false);
    mockGetTracker.mockReturnValue(unhealthyTracker);

    await expect(program.parseAsync(["node", "test", "health"])).rejects.toThrow("process.exit(1)");
  });

  describe("YAML health config (Story 10.1)", () => {
    it("applies thresholds from config.health section", async () => {
      (mockConfigRef.current as Record<string, unknown>).health = {
        thresholds: {
          maxLatencyMs: 500,
          maxQueueDepth: 200,
        },
        checkIntervalMs: 15000,
        alertOnTransition: true,
      };

      await program.parseAsync(["node", "test", "health"]);

      const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
      // Should still render health output — no crash with config present
      expect(output).toContain("System Health");
      expect(output).toContain("healthy");
    });

    it("works without health config section (backward compatible)", async () => {
      // config.health is undefined (default)
      delete (mockConfigRef.current as Record<string, unknown>).health;

      await program.parseAsync(["node", "test", "health"]);

      const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("System Health");
    });

    it("CLI --interval flag overrides config.health.checkIntervalMs", async () => {
      (mockConfigRef.current as Record<string, unknown>).health = {
        checkIntervalMs: 60000,
      };

      // --interval should take precedence over config
      await program.parseAsync(["node", "test", "health", "--interval", "5000"]);

      const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("System Health");
    });
  });
});
