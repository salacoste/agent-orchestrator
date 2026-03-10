import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSandboxManager, type SandboxConfig, type SandboxResult } from "../plugin-sandbox.js";

// Note: These tests focus on the public API and configuration.
// Integration tests that actually spawn processes would be in the integration test suite.

describe("createSandboxManager", () => {
  it("returns a sandbox manager object", () => {
    const manager = createSandboxManager();
    expect(manager).toHaveProperty("getSandbox");
    expect(manager).toHaveProperty("shutdownAll");
    expect(manager).toHaveProperty("getActiveSandboxes");
    expect(manager).toHaveProperty("getResourceUsage");
  });

  it("initially has no active sandboxes", () => {
    const manager = createSandboxManager();
    expect(manager.getActiveSandboxes()).toEqual([]);
    expect(manager.getResourceUsage()).toEqual({ count: 0, estimatedMemoryMB: 0 });
  });

  it("returns same sandbox for same plugin path", () => {
    const manager = createSandboxManager();
    const sandbox1 = manager.getSandbox("/path/to/plugin.js");
    const sandbox2 = manager.getSandbox("/path/to/plugin.js");
    expect(sandbox1.getId()).toBe(sandbox2.getId());
  });

  it("returns different sandboxes for different plugin paths", () => {
    const manager = createSandboxManager();
    const sandbox1 = manager.getSandbox("/path/to/plugin1.js");
    const sandbox2 = manager.getSandbox("/path/to/plugin2.js");
    expect(sandbox1.getId()).not.toBe(sandbox2.getId());
  });

  it("accepts custom configuration", () => {
    const manager = createSandboxManager();
    const config: SandboxConfig = {
      timeout: 60000,
      maxMemoryMB: 512,
      allowedReadPaths: ["/tmp"],
      allowedWritePaths: ["/tmp/output"],
      allowNetwork: false,
      allowSpawn: false,
      env: { CUSTOM_VAR: "value" },
    };
    const sandbox = manager.getSandbox("/path/to/plugin.js", config);
    expect(sandbox).toBeDefined();
  });

  it("tracks resource usage across sandboxes", () => {
    const manager = createSandboxManager();
    manager.getSandbox("/path/to/plugin1.js", { maxMemoryMB: 128 });
    manager.getSandbox("/path/to/plugin2.js", { maxMemoryMB: 256 });
    manager.getSandbox("/path/to/plugin3.js", { maxMemoryMB: 512 });

    const usage = manager.getResourceUsage();
    expect(usage.count).toBe(3);
    // Default is 256 + 128 + 256 + 512 = 896? No - first one gets 128, others get defaults if not cached
    // Actually each unique path gets its own sandbox with specified config
    expect(usage.estimatedMemoryMB).toBe(128 + 256 + 512);
  });
});

describe("PluginSandbox", () => {
  it("has required methods", () => {
    const manager = createSandboxManager();
    const sandbox = manager.getSandbox("/path/to/plugin.js");
    expect(typeof sandbox.execute).toBe("function");
    expect(typeof sandbox.shutdown).toBe("function");
    expect(typeof sandbox.getId).toBe("function");
    expect(typeof sandbox.isHealthy).toBe("function");
  });

  it("returns unique sandbox ID", () => {
    const manager = createSandboxManager();
    const sandbox1 = manager.getSandbox("/path/to/plugin1.js");
    const sandbox2 = manager.getSandbox("/path/to/plugin2.js");
    expect(sandbox1.getId()).not.toBe(sandbox2.getId());
  });

  it("reports not healthy before start", () => {
    const manager = createSandboxManager();
    const sandbox = manager.getSandbox("/nonexistent/plugin.js");
    // Sandbox auto-starts but will fail to find the plugin
    // So isHealthy should be false
    expect(sandbox.isHealthy()).toBe(false);
  });

  it("shutdown completes without error for non-started sandbox", async () => {
    const manager = createSandboxManager();
    const sandbox = manager.getSandbox("/nonexistent/plugin.js");
    await expect(sandbox.shutdown()).resolves.toBeUndefined();
  });
});

describe("SandboxConfig", () => {
  it("uses default values for missing config", () => {
    const manager = createSandboxManager();
    // Create sandbox with empty config - should use defaults
    const sandbox = manager.getSandbox("/path/to/plugin.js", {});
    expect(sandbox).toBeDefined();
    // Resource usage should reflect default maxMemoryMB (256)
    const usage = manager.getResourceUsage();
    expect(usage.estimatedMemoryMB).toBe(256);
  });

  it("validates timeout configuration", () => {
    const manager = createSandboxManager();
    const sandbox = manager.getSandbox("/path/to/plugin.js", {
      timeout: 1000, // 1 second
    });
    expect(sandbox).toBeDefined();
  });

  it("validates memory configuration", () => {
    const manager = createSandboxManager();
    const sandbox = manager.getSandbox("/path/to/plugin.js", {
      maxMemoryMB: 1024, // 1 GB
    });
    expect(sandbox).toBeDefined();
    const usage = manager.getResourceUsage();
    expect(usage.estimatedMemoryMB).toBe(1024);
  });

  it("accepts path restrictions", () => {
    const manager = createSandboxManager();
    const sandbox = manager.getSandbox("/path/to/plugin.js", {
      allowedReadPaths: ["/app/data"],
      allowedWritePaths: ["/app/output"],
    });
    expect(sandbox).toBeDefined();
  });

  it("accepts security settings", () => {
    const manager = createSandboxManager();
    const sandbox = manager.getSandbox("/path/to/plugin.js", {
      allowNetwork: false,
      allowSpawn: false,
    });
    expect(sandbox).toBeDefined();
  });
});

describe("SandboxManager lifecycle", () => {
  let manager: ReturnType<typeof createSandboxManager>;

  beforeEach(() => {
    manager = createSandboxManager();
  });

  afterEach(async () => {
    await manager.shutdownAll();
  });

  it("shutdownAll completes without error", async () => {
    manager.getSandbox("/path/to/plugin1.js");
    manager.getSandbox("/path/to/plugin2.js");
    await expect(manager.shutdownAll()).resolves.toBeUndefined();
  });

  it("clears sandboxes after shutdownAll", async () => {
    manager.getSandbox("/path/to/plugin.js");
    await manager.shutdownAll();
    expect(manager.getActiveSandboxes()).toEqual([]);
    expect(manager.getResourceUsage()).toEqual({ count: 0, estimatedMemoryMB: 0 });
  });

  it("can create new sandbox after shutdown", async () => {
    const sandbox1 = manager.getSandbox("/path/to/plugin.js");
    await manager.shutdownAll();
    const sandbox2 = manager.getSandbox("/path/to/plugin.js");
    expect(sandbox1.getId()).not.toBe(sandbox2.getId());
  });
});

describe("SandboxResult type", () => {
  it("defines correct success shape", () => {
    const result: SandboxResult<string> = {
      success: true,
      data: "test result",
      duration: 100,
      memoryUsedMB: 50,
    };
    expect(result.success).toBe(true);
    expect(result.data).toBe("test result");
  });

  it("defines correct error shape", () => {
    const result: SandboxResult<never> = {
      success: false,
      error: "Something went wrong",
      duration: 50,
      timedOut: false,
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong");
  });

  it("defines correct timeout shape", () => {
    const result: SandboxResult<never> = {
      success: false,
      error: "Execution timed out after 30000ms",
      duration: 30000,
      timedOut: true,
    };
    expect(result.timedOut).toBe(true);
  });
});
