import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SprintPlanningResult } from "@composio/ao-plugin-tracker-bmad";

const { mockConfigRef, mockComputeSprintPlan } = vi.hoisted(() => ({
  mockConfigRef: { current: null as Record<string, unknown> | null },
  mockComputeSprintPlan: vi.fn(),
}));

vi.mock("@composio/ao-core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@composio/ao-core")>();
  return {
    ...actual,
    loadConfig: () => mockConfigRef.current,
  };
});

vi.mock("@composio/ao-plugin-tracker-bmad", () => ({
  computeSprintPlan: mockComputeSprintPlan,
}));

let tmpDir: string;

import { Command } from "commander";
import { registerPlan } from "../../src/commands/plan.js";

let program: Command;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeResult(overrides: Partial<SprintPlanningResult> = {}): SprintPlanningResult {
  return {
    backlogStories: [],
    recommended: [],
    sprintConfig: {
      startDate: null,
      endDate: null,
      goal: null,
      targetVelocity: null,
    },
    capacity: {
      historicalVelocity: 0,
      targetVelocity: null,
      effectiveTarget: 0,
      inProgressCount: 0,
      remainingCapacity: 0,
    },
    loadStatus: "no-data",
    hasPoints: false,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ao-plan-test-"));

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

  mockComputeSprintPlan.mockReturnValue(makeResult());

  program = new Command();
  program.exitOverride();
  registerPlan(program);

  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("plan command", () => {
  it("displays formatted output with recommended stories", async () => {
    mockComputeSprintPlan.mockReturnValue(
      makeResult({
        recommended: [
          { id: "s1", title: "Add login", epic: "epic-auth", isBlocked: false, blockers: [] },
          { id: "s2", title: "Add signup", epic: null, isBlocked: false, blockers: [] },
        ],
        backlogStories: [
          { id: "s1", title: "Add login", epic: "epic-auth", isBlocked: false, blockers: [] },
          { id: "s2", title: "Add signup", epic: null, isBlocked: false, blockers: [] },
        ],
        capacity: {
          historicalVelocity: 3.5,
          targetVelocity: 5,
          effectiveTarget: 5,
          inProgressCount: 2,
          remainingCapacity: 3,
        },
        loadStatus: "under",
      }),
    );

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Sprint Planning");
    expect(output).toContain("Recommended");
    expect(output).toContain("s1");
    expect(output).toContain("Add login");
    expect(output).toContain("under");
  });

  it("outputs valid JSON with --json flag", async () => {
    const result = makeResult({
      loadStatus: "under",
      capacity: {
        historicalVelocity: 2,
        targetVelocity: 5,
        effectiveTarget: 5,
        inProgressCount: 1,
        remainingCapacity: 4,
      },
    });
    mockComputeSprintPlan.mockReturnValue(result);

    await program.parseAsync(["node", "test", "plan", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output) as SprintPlanningResult;
    expect(parsed.loadStatus).toBe("under");
    expect(parsed.capacity.remainingCapacity).toBe(4);
  });

  it("falls back to YAML when non-bmad tracker configured", async () => {
    const projects = (mockConfigRef.current as Record<string, unknown>)["projects"] as Record<
      string,
      Record<string, unknown>
    >;
    projects["my-app"]["tracker"] = { plugin: "github" };

    // No sprint-status.yaml exists → should error with file-not-found (YAML fallback path)
    await expect(program.parseAsync(["node", "test", "plan"])).rejects.toThrow("process.exit(1)");

    const errorOutput = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(errorOutput).toMatch(/sprint-status\.yaml not found/);
  });

  it("displays blocked stories", async () => {
    mockComputeSprintPlan.mockReturnValue(
      makeResult({
        backlogStories: [
          { id: "s1", title: "Auth feature", epic: null, isBlocked: true, blockers: ["s3"] },
        ],
        recommended: [],
      }),
    );

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Blocked");
    expect(output).toContain("s3");
  });

  it("handles empty backlog", async () => {
    mockComputeSprintPlan.mockReturnValue(makeResult());

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No stories in backlog");
  });

  it("displays sprint config when set", async () => {
    mockComputeSprintPlan.mockReturnValue(
      makeResult({
        sprintConfig: {
          startDate: "2026-03-01",
          endDate: "2026-03-14",
          goal: "Complete auth epic",
          targetVelocity: 8,
        },
      }),
    );

    await program.parseAsync(["node", "test", "plan"]);

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Complete auth epic");
    expect(output).toContain("2026-03-01");
    expect(output).toContain("2026-03-14");
  });

  it("resolves project when specified", async () => {
    await program.parseAsync(["node", "test", "plan", "my-app"]);

    expect(mockComputeSprintPlan).toHaveBeenCalled();
  });
});
