import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPluginRegistry } from "../plugin-registry.js";
import type { PluginModule, PluginManifest, OrchestratorConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlugin(slot: PluginManifest["slot"], name: string): PluginModule {
  return {
    manifest: {
      name,
      slot,
      description: `Test ${slot} plugin: ${name}`,
      version: "0.0.1",
    },
    create: vi.fn((config?: Record<string, unknown>) => ({
      name,
      _config: config,
    })),
  };
}

function makeOrchestratorConfig(overrides?: Partial<OrchestratorConfig>): OrchestratorConfig {
  return {
    projects: {},
    ...overrides,
  } as OrchestratorConfig;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPluginRegistry", () => {
  it("returns a registry object", () => {
    const registry = createPluginRegistry();
    expect(registry).toHaveProperty("register");
    expect(registry).toHaveProperty("get");
    expect(registry).toHaveProperty("list");
    expect(registry).toHaveProperty("loadBuiltins");
    expect(registry).toHaveProperty("loadFromConfig");
  });
});

describe("register + get", () => {
  it("registers and retrieves a plugin", () => {
    const registry = createPluginRegistry();
    const plugin = makePlugin("runtime", "tmux");

    registry.register(plugin);

    const instance = registry.get<{ name: string }>("runtime", "tmux");
    expect(instance).not.toBeNull();
    expect(instance!.name).toBe("tmux");
  });

  it("returns null for unregistered plugin", () => {
    const registry = createPluginRegistry();
    expect(registry.get("runtime", "nonexistent")).toBeNull();
  });

  it("passes config to plugin create()", () => {
    const registry = createPluginRegistry();
    const plugin = makePlugin("workspace", "worktree");

    registry.register(plugin, { worktreeDir: "/custom/path" });

    expect(plugin.create).toHaveBeenCalledWith({ worktreeDir: "/custom/path" });
    const instance = registry.get<{ _config: Record<string, unknown> }>("workspace", "worktree");
    expect(instance!._config).toEqual({ worktreeDir: "/custom/path" });
  });

  it("overwrites previously registered plugin with same slot:name", () => {
    const registry = createPluginRegistry();
    const plugin1 = makePlugin("runtime", "tmux");
    const plugin2 = makePlugin("runtime", "tmux");

    registry.register(plugin1);
    registry.register(plugin2);

    // Should call create on both
    expect(plugin1.create).toHaveBeenCalledTimes(1);
    expect(plugin2.create).toHaveBeenCalledTimes(1);

    // get() returns the latest
    const instance = registry.get<{ name: string }>("runtime", "tmux");
    expect(instance).not.toBeNull();
  });

  it("registers plugins in different slots independently", () => {
    const registry = createPluginRegistry();
    const runtimePlugin = makePlugin("runtime", "tmux");
    const workspacePlugin = makePlugin("workspace", "worktree");

    registry.register(runtimePlugin);
    registry.register(workspacePlugin);

    expect(registry.get("runtime", "tmux")).not.toBeNull();
    expect(registry.get("workspace", "worktree")).not.toBeNull();
    expect(registry.get("runtime", "worktree")).toBeNull();
    expect(registry.get("workspace", "tmux")).toBeNull();
  });
});

describe("list", () => {
  it("lists plugins in a given slot", () => {
    const registry = createPluginRegistry();
    registry.register(makePlugin("runtime", "tmux"));
    registry.register(makePlugin("runtime", "process"));
    registry.register(makePlugin("workspace", "worktree"));

    const runtimes = registry.list("runtime");
    expect(runtimes).toHaveLength(2);
    expect(runtimes.map((m) => m.name)).toContain("tmux");
    expect(runtimes.map((m) => m.name)).toContain("process");
  });

  it("returns empty array for slot with no plugins", () => {
    const registry = createPluginRegistry();
    expect(registry.list("notifier")).toEqual([]);
  });

  it("does not return plugins from other slots", () => {
    const registry = createPluginRegistry();
    registry.register(makePlugin("runtime", "tmux"));

    expect(registry.list("workspace")).toEqual([]);
  });
});

describe("loadBuiltins", () => {
  it("silently skips unavailable packages", async () => {
    const registry = createPluginRegistry();
    // loadBuiltins tries to import all built-in packages.
    // In the test environment, most are not resolvable — should not throw.
    await expect(registry.loadBuiltins()).resolves.toBeUndefined();
  });

  it("registers multiple agent plugins from importFn", async () => {
    const registry = createPluginRegistry();

    const fakeClaudeCode = makePlugin("agent", "claude-code");
    const fakeCodex = makePlugin("agent", "codex");

    await registry.loadBuiltins(undefined, async (pkg: string) => {
      if (pkg === "@composio/ao-plugin-agent-claude-code") return fakeClaudeCode;
      if (pkg === "@composio/ao-plugin-agent-codex") return fakeCodex;
      throw new Error(`Not found: ${pkg}`);
    });

    const agents = registry.list("agent");
    expect(agents).toContainEqual(expect.objectContaining({ name: "claude-code", slot: "agent" }));
    expect(agents).toContainEqual(expect.objectContaining({ name: "codex", slot: "agent" }));

    expect(registry.get("agent", "codex")).not.toBeNull();
    expect(registry.get("agent", "claude-code")).not.toBeNull();
  });
});

describe("extractPluginConfig (via register with config)", () => {
  // extractPluginConfig is tested indirectly: we verify that register()
  // correctly passes config through, and that loadBuiltins() would call
  // extractPluginConfig for known slot:name pairs. The actual config
  // forwarding logic is validated in workspace plugin unit tests.

  it("register passes config to plugin create()", () => {
    const registry = createPluginRegistry();
    const plugin = makePlugin("workspace", "worktree");

    registry.register(plugin, { worktreeDir: "/custom/path" });

    expect(plugin.create).toHaveBeenCalledWith({ worktreeDir: "/custom/path" });
  });

  it("register passes undefined config when none provided", () => {
    const registry = createPluginRegistry();
    const plugin = makePlugin("workspace", "clone");

    registry.register(plugin);

    expect(plugin.create).toHaveBeenCalledWith(undefined);
  });
});

describe("loadFromConfig", () => {
  it("does not throw when no plugins are importable", async () => {
    const registry = createPluginRegistry();
    const config = makeOrchestratorConfig({});

    // loadFromConfig calls loadBuiltins internally, which may fail to
    // import packages in the test env — should still succeed gracefully
    await expect(registry.loadFromConfig(config)).resolves.toBeUndefined();
  });
});

describe("lifecycle hooks", () => {
  it("calls module-level init() after registration", async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    const plugin: PluginModule = {
      ...makePlugin("runtime", "tmux"),
      init: initFn,
    };

    const registry = createPluginRegistry();
    registry.register(plugin);

    // init is called asynchronously, so we need to wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(initFn).toHaveBeenCalledTimes(1);
  });

  it("calls instance-level init() after registration", async () => {
    const instanceInit = vi.fn().mockResolvedValue(undefined);
    const plugin = {
      ...makePlugin("runtime", "tmux"),
      create: vi.fn(() => ({
        name: "tmux",
        init: instanceInit,
      })),
    };

    const registry = createPluginRegistry();
    registry.register(plugin);

    // init is called asynchronously
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(instanceInit).toHaveBeenCalledTimes(1);
  });

  it("calls shutdown() when shutdown is invoked", async () => {
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const plugin: PluginModule = {
      ...makePlugin("runtime", "tmux"),
      shutdown: shutdownFn,
    };

    const registry = createPluginRegistry();
    registry.register(plugin);

    const result = await registry.shutdown("runtime", "tmux");

    expect(result).toBe(true);
    expect(shutdownFn).toHaveBeenCalledTimes(1);
    expect(registry.get("runtime", "tmux")).toBeNull();
  });

  it("calls instance-level shutdown() when shutdown is invoked", async () => {
    const instanceShutdown = vi.fn().mockResolvedValue(undefined);
    const plugin = {
      ...makePlugin("runtime", "tmux"),
      create: vi.fn(() => ({
        name: "tmux",
        shutdown: instanceShutdown,
      })),
    };

    const registry = createPluginRegistry();
    registry.register(plugin);

    const result = await registry.shutdown("runtime", "tmux");

    expect(result).toBe(true);
    expect(instanceShutdown).toHaveBeenCalledTimes(1);
  });

  it("returns false when shutting down non-existent plugin", async () => {
    const registry = createPluginRegistry();
    const result = await registry.shutdown("runtime", "nonexistent");
    expect(result).toBe(false);
  });

  it("shutdownAll calls shutdown on all plugins", async () => {
    const shutdown1 = vi.fn().mockResolvedValue(undefined);
    const shutdown2 = vi.fn().mockResolvedValue(undefined);

    const plugin1: PluginModule = {
      ...makePlugin("runtime", "tmux"),
      shutdown: shutdown1,
    };
    const plugin2: PluginModule = {
      ...makePlugin("runtime", "process"),
      shutdown: shutdown2,
    };

    const registry = createPluginRegistry();
    registry.register(plugin1);
    registry.register(plugin2);

    await registry.shutdownAll();

    expect(shutdown1).toHaveBeenCalledTimes(1);
    expect(shutdown2).toHaveBeenCalledTimes(1);
    expect(registry.list("runtime")).toHaveLength(0);
  });

  it("handles init() errors gracefully", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const initFn = vi.fn().mockRejectedValue(new Error("init failed"));
    const plugin: PluginModule = {
      ...makePlugin("runtime", "tmux"),
      init: initFn,
    };

    const registry = createPluginRegistry();
    // Should not throw
    registry.register(plugin);

    // Wait for async init to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(initFn).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("handles shutdown() errors gracefully", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const shutdownFn = vi.fn().mockRejectedValue(new Error("shutdown failed"));
    const plugin: PluginModule = {
      ...makePlugin("runtime", "tmux"),
      shutdown: shutdownFn,
    };

    const registry = createPluginRegistry();
    registry.register(plugin);

    // Should not throw
    await registry.shutdown("runtime", "tmux");

    expect(shutdownFn).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
