import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("assign-next command", () => {
  const assignNextPath = join(__dirname, "../../src/commands/assign-next.ts");

  it("imports selectNextStory and getAssignableStories from ao-core", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    expect(content).toContain("selectNextStory");
    expect(content).toContain("getAssignableStories");
    expect(content).toContain("@composio/ao-core");
  });

  it("registers as 'assign-next' command with required agent-id argument", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    expect(content).toContain('.command("assign-next")');
    expect(content).toContain('.argument("<agent-id>"');
  });

  it("supports --dry-run flag to display queue without assigning", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    expect(content).toContain("--dry-run");
    expect(content).toContain("displayQueue");
    // Dry run should NOT call registry.register
    const dryRunSection = content.slice(
      content.indexOf("if (opts.dryRun)"),
      content.indexOf("// Select next story"),
    );
    expect(dryRunSection).not.toContain("registry.register");
  });

  it("supports --force flag to skip confirmation", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    expect(content).toContain("--force");
    expect(content).toContain("opts.force");
  });

  it("calls registry.register with priority from candidate", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    // Must register with priority from the candidate
    expect(content).toContain("priority: candidate.priority");
    expect(content).toContain("registry.register");
  });

  it("exits gracefully when no assignable stories found", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    // When selectNextStory returns null, should show info and exit 0
    expect(content).toContain("No assignable stories");
    expect(content).toContain("process.exit(0)");
  });

  it("logs assignment to audit trail with auto-assign event type", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    expect(content).toContain('event_type: "auto-assign"');
    expect(content).toContain('source: "assign-next"');
  });

  it("reloads registry from disk before selecting", () => {
    const content = readFileSync(assignNextPath, "utf-8");

    // Must reload to get latest state from disk
    expect(content).toContain("await registry.reload()");
  });
});

describe("assign-next — behavioral tests", () => {
  it("selectNextStory returns highest priority story", async () => {
    const { selectNextStory, getAgentRegistry } = await import("@composio/ao-core");
    const fsMod = await import("node:fs");
    const pathMod = await import("node:path");
    const osMod = await import("node:os");
    const cryptoMod = await import("node:crypto");

    const projectDir = pathMod.join(
      osMod.tmpdir(),
      `ao-assign-next-test-${cryptoMod.randomUUID()}`,
    );
    const registryDir = pathMod.join(
      osMod.tmpdir(),
      `ao-assign-next-reg-${cryptoMod.randomUUID()}`,
    );
    fsMod.mkdirSync(projectDir, { recursive: true });
    fsMod.mkdirSync(registryDir, { recursive: true });

    try {
      fsMod.writeFileSync(
        pathMod.join(projectDir, "sprint-status.yaml"),
        `
development_status:
  epic-1: in-progress
  1-1-low: ready-for-dev
  1-2-high: ready-for-dev

priorities:
  1-1-low: 0
  1-2-high: 5
`,
        "utf-8",
      );

      const config = {
        configPath: pathMod.join(registryDir, "config.yaml"),
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

      const registry = getAgentRegistry(registryDir, config);
      const result = selectNextStory(projectDir, registry);

      expect(result).not.toBeNull();
      expect(result!.storyId).toBe("1-2-high");
      expect(result!.priority).toBe(5);
    } finally {
      fsMod.rmSync(projectDir, { recursive: true, force: true });
      fsMod.rmSync(registryDir, { recursive: true, force: true });
    }
  });

  it("selectNextStory returns null when no stories available", async () => {
    const { selectNextStory, getAgentRegistry } = await import("@composio/ao-core");
    const fsMod = await import("node:fs");
    const pathMod = await import("node:path");
    const osMod = await import("node:os");
    const cryptoMod = await import("node:crypto");

    const projectDir = pathMod.join(
      osMod.tmpdir(),
      `ao-assign-next-empty-${cryptoMod.randomUUID()}`,
    );
    const registryDir = pathMod.join(
      osMod.tmpdir(),
      `ao-assign-next-ereg-${cryptoMod.randomUUID()}`,
    );
    fsMod.mkdirSync(projectDir, { recursive: true });
    fsMod.mkdirSync(registryDir, { recursive: true });

    try {
      fsMod.writeFileSync(
        pathMod.join(projectDir, "sprint-status.yaml"),
        `
development_status:
  epic-1: in-progress
  1-1-done: done
  1-2-in-progress: in-progress
`,
        "utf-8",
      );

      const config = {
        configPath: pathMod.join(registryDir, "config.yaml"),
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

      const registry = getAgentRegistry(registryDir, config);
      const result = selectNextStory(projectDir, registry);

      expect(result).toBeNull();
    } finally {
      fsMod.rmSync(projectDir, { recursive: true, force: true });
      fsMod.rmSync(registryDir, { recursive: true, force: true });
    }
  });

  it("getAssignableStories returns sorted queue for dry-run display", async () => {
    const { getAssignableStories, getAgentRegistry } = await import("@composio/ao-core");
    const fsMod = await import("node:fs");
    const pathMod = await import("node:path");
    const osMod = await import("node:os");
    const cryptoMod = await import("node:crypto");

    const projectDir = pathMod.join(
      osMod.tmpdir(),
      `ao-assign-next-dryrun-${cryptoMod.randomUUID()}`,
    );
    const registryDir = pathMod.join(
      osMod.tmpdir(),
      `ao-assign-next-dreg-${cryptoMod.randomUUID()}`,
    );
    fsMod.mkdirSync(projectDir, { recursive: true });
    fsMod.mkdirSync(registryDir, { recursive: true });

    try {
      fsMod.writeFileSync(
        pathMod.join(projectDir, "sprint-status.yaml"),
        `
development_status:
  epic-1: in-progress
  1-1-a: ready-for-dev
  1-2-b: ready-for-dev
  1-3-c: ready-for-dev
`,
        "utf-8",
      );

      const config = {
        configPath: pathMod.join(registryDir, "config.yaml"),
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

      const registry = getAgentRegistry(registryDir, config);
      const candidates = getAssignableStories(projectDir, registry);

      expect(candidates).toHaveLength(3);
      // FIFO order preserved for equal priority
      expect(candidates[0].storyId).toBe("1-1-a");
      expect(candidates[1].storyId).toBe("1-2-b");
      expect(candidates[2].storyId).toBe("1-3-c");
    } finally {
      fsMod.rmSync(projectDir, { recursive: true, force: true });
      fsMod.rmSync(registryDir, { recursive: true, force: true });
    }
  });
});
