import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  selectNextStory,
  getAssignableStories,
  resolveDependencies,
  getAgentRegistry,
  type AgentStatus,
  type OrchestratorConfig,
} from "@composio/ao-core";

function makeConfig(tmpDir: string): OrchestratorConfig {
  return {
    configPath: join(tmpDir, "config.yaml"),
    port: 5000,
    defaults: { runtime: "mock", agent: "mock", workspace: "mock", notifiers: [] as string[] },
    projects: {},
    notifiers: {},
    notificationRouting: {
      urgent: [] as string[],
      action: [] as string[],
      warning: [] as string[],
      info: [] as string[],
    },
    reactions: {},
    readyThresholdMs: 300_000,
  };
}

function writeSprintStatus(dir: string, content: string): void {
  writeFileSync(join(dir, "sprint-status.yaml"), content, "utf-8");
}

describe("AssignmentService", () => {
  let projectDir: string;
  let registryDir: string;
  let config: OrchestratorConfig;

  beforeEach(() => {
    projectDir = join(tmpdir(), `ao-assign-test-${randomUUID()}`);
    registryDir = join(tmpdir(), `ao-assign-registry-${randomUUID()}`);
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(registryDir, { recursive: true });
    config = makeConfig(registryDir);
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(registryDir, { recursive: true, force: true });
  });

  it("returns single assignable story", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-first-story: done
  1-2-second-story: ready-for-dev
  1-3-third-story: backlog
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const result = selectNextStory(projectDir, registry);

    expect(result).not.toBeNull();
    expect(result!.storyId).toBe("1-2-second-story");
    expect(result!.epicId).toBe("epic-1");
  });

  it("sorts by priority descending (highest first)", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-low-priority: ready-for-dev
  1-2-high-priority: ready-for-dev
  1-3-medium-priority: ready-for-dev

priorities:
  1-1-low-priority: 0
  1-2-high-priority: 10
  1-3-medium-priority: 5
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const candidates = getAssignableStories(projectDir, registry);

    expect(candidates).toHaveLength(3);
    expect(candidates[0].storyId).toBe("1-2-high-priority");
    expect(candidates[0].priority).toBe(10);
    expect(candidates[1].storyId).toBe("1-3-medium-priority");
    expect(candidates[1].priority).toBe(5);
    expect(candidates[2].storyId).toBe("1-1-low-priority");
    expect(candidates[2].priority).toBe(0);
  });

  it("uses FIFO ordering for equal priority", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-first-story: ready-for-dev
  1-2-second-story: ready-for-dev
  1-3-third-story: ready-for-dev
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const candidates = getAssignableStories(projectDir, registry);

    expect(candidates).toHaveLength(3);
    // All have priority 0, so FIFO order should be preserved
    expect(candidates[0].storyId).toBe("1-1-first-story");
    expect(candidates[1].storyId).toBe("1-2-second-story");
    expect(candidates[2].storyId).toBe("1-3-third-story");
    // Positions should be ascending
    expect(candidates[0].position).toBeLessThan(candidates[1].position);
    expect(candidates[1].position).toBeLessThan(candidates[2].position);
  });

  it("excludes stories with active assignments", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-assigned-story: ready-for-dev
  1-2-free-story: ready-for-dev
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    registry.register({
      agentId: "agent-1",
      storyId: "1-1-assigned-story",
      assignedAt: new Date(),
      status: "active" as AgentStatus,
      contextHash: "hash1",
      priority: 0,
    });

    const candidates = getAssignableStories(projectDir, registry);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].storyId).toBe("1-2-free-story");
  });

  it("skips stories with unresolved dependencies", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-prereq-story: in-progress
  1-2-blocked-story: ready-for-dev
  1-3-free-story: ready-for-dev

dependencies:
  1-2-blocked-story:
    - 1-1-prereq-story
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const candidates = getAssignableStories(projectDir, registry);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].storyId).toBe("1-3-free-story");
  });

  it("returns null when all stories have unresolved deps", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-prereq: in-progress
  1-2-blocked-a: ready-for-dev
  1-3-blocked-b: ready-for-dev

dependencies:
  1-2-blocked-a:
    - 1-1-prereq
  1-3-blocked-b:
    - 1-1-prereq
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const result = selectNextStory(projectDir, registry);

    expect(result).toBeNull();
  });

  it("resolves dependencies — done deps resolve, in-progress deps don't", () => {
    const sprintData = {
      development_status: {
        "1-1-done-dep": "done",
        "1-2-wip-dep": "in-progress",
        "1-3-target": "ready-for-dev",
      },
      dependencies: {
        "1-3-target": ["1-1-done-dep", "1-2-wip-dep"],
      },
    };

    const result = resolveDependencies("1-3-target", sprintData);

    expect(result.resolved).toBe(false);
    expect(result.unresolved).toEqual(["1-2-wip-dep"]);
  });

  it("resolves dependencies — all done returns resolved", () => {
    const sprintData = {
      development_status: {
        "1-1-dep-a": "done",
        "1-2-dep-b": "done",
        "1-3-target": "ready-for-dev",
      },
      dependencies: {
        "1-3-target": ["1-1-dep-a", "1-2-dep-b"],
      },
    };

    const result = resolveDependencies("1-3-target", sprintData);

    expect(result.resolved).toBe(true);
    expect(result.unresolved).toEqual([]);
  });

  it("stories without dependencies are always assignable", () => {
    const sprintData = {
      development_status: {
        "1-1-no-deps": "ready-for-dev",
      },
    };

    const result = resolveDependencies("1-1-no-deps", sprintData);

    expect(result.resolved).toBe(true);
    expect(result.unresolved).toEqual([]);
  });

  it("returns empty list when sprint-status.yaml is missing", () => {
    const registry = getAgentRegistry(registryDir, config);
    const candidates = getAssignableStories(projectDir, registry);

    expect(candidates).toEqual([]);
  });

  it("ignores epic keys and retrospective entries", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-real-story: ready-for-dev
  epic-1-retrospective: optional
  epic-2: backlog
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const candidates = getAssignableStories(projectDir, registry);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].storyId).toBe("1-1-real-story");
  });

  it("does not include backlog stories (only ready-for-dev)", () => {
    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
  1-1-ready: ready-for-dev
  1-2-backlog: backlog
  1-3-done: done
  1-4-in-progress: in-progress
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const candidates = getAssignableStories(projectDir, registry);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].storyId).toBe("1-1-ready");
  });

  it("completes within 500ms (NFR-P8)", () => {
    // Create a realistic sprint-status.yaml with ~50 stories
    const stories: string[] = [];
    for (let i = 1; i <= 50; i++) {
      const status = i <= 10 ? "done" : i <= 30 ? "ready-for-dev" : "backlog";
      stories.push(`  ${1}-${i}-story-${i}: ${status}`);
    }

    writeSprintStatus(
      projectDir,
      `
development_status:
  epic-1: in-progress
${stories.join("\n")}
`,
    );

    const registry = getAgentRegistry(registryDir, config);
    const start = Date.now();

    selectNextStory(projectDir, registry);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
